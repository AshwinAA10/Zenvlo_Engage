import {
  Injectable,
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { UploadBase64Dto, UploadResponseDto } from '../models/storage.dto';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_VIDEO_SIZE = 30 * 1024 * 1024; // 30 MB

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const ALLOWED_VIDEO_TYPES: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

@Injectable()
export class StorageService {
  private s3Client: S3Client | null = null;
  private bucket: string | null = null;
  private cdnUrl: string | null = null;
  private localUploadsDir: string;

  private static readonly ALLOWED_FOLDERS = new Set(['photos', 'videos', 'logos']);
  private static readonly SAFE_FILENAME_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|gif|mp4|webm|mov)$/i;
  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(StorageService.name);

    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY');
    const bucket = this.configService.get<string>('S3_BUCKET');
    const region = this.configService.get<string>('S3_REGION') || 'ap-south-1';
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    this.cdnUrl = this.configService.get<string>('S3_PUBLIC_URL') || null;

    if (accessKeyId && secretAccessKey && bucket) {
      this.bucket = bucket;
      this.s3Client = new S3Client({
        region,
        endpoint: endpoint || undefined,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.logger.info(`S3-compatible storage configured for bucket '${bucket}'`);
    } else {
      this.logger.info('S3 credentials not supplied. Using secure local file storage.');
    }

    this.localUploadsDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(this.localUploadsDir)) {
      fs.mkdirSync(this.localUploadsDir, { recursive: true, mode: 0o755 });
    }
  }

  /**
   * Validates binary buffer magic bytes to prevent MIME spoofing.
   * Strictly inspects binary headers; never trusts user claims.
   */
  private detectMimeType(buffer: Buffer): string | null {
    if (buffer.length < 8) return null;

    // 1. PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return 'image/png';
    }

    // 2. JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    // 3. GIF: GIF87a or GIF89a (47 49 46 38 37/39 61)
    if (
      buffer.length >= 6 &&
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) &&
      buffer[5] === 0x61
    ) {
      return 'image/gif';
    }

    // 4. WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
    if (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return 'image/webp';
    }

    // 5. WebM: 1A 45 DF A3
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3
    ) {
      return 'video/webm';
    }

    // 6. MP4 / MOV: check for 'ftyp' or 'moov' at bytes 4-8
    if (buffer.length >= 12) {
      const box = buffer.toString('ascii', 4, 8);
      if (box === 'ftyp' || box === 'moov') {
        const brand = buffer.toString('ascii', 8, 12);
        if (brand === 'qt  ') return 'video/quicktime';
        return 'video/mp4';
      }
    }

    return null;
  }

  /**
   * Scans buffer for dangerous executable headers or embedded script tags.
   */
  private scanForDangerousContent(buffer: Buffer): void {
    // 1. Executable file headers
    // PE/MZ executable (Windows .exe, .dll)
    if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
      throw new UnsupportedMediaTypeException('Executable files (PE/MZ) are strictly forbidden');
    }
    // ELF executable (Linux binary)
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x7f &&
      buffer[1] === 0x45 &&
      buffer[2] === 0x4c &&
      buffer[3] === 0x46
    ) {
      throw new UnsupportedMediaTypeException('Executable files (ELF) are strictly forbidden');
    }
    // Java class / Mach-O binary
    if (
      buffer.length >= 4 &&
      buffer[0] === 0xca &&
      buffer[1] === 0xfe &&
      buffer[2] === 0xba &&
      buffer[3] === 0xbe
    ) {
      throw new UnsupportedMediaTypeException('Binary executable formats are strictly forbidden');
    }
    // Shell script (#!/bin/)
    if (buffer.length >= 2 && buffer[0] === 0x23 && buffer[1] === 0x21) {
      throw new UnsupportedMediaTypeException('Shell scripts are strictly forbidden');
    }

    // 2. Embedded script/markup scanning in boundary chunks
    const scanChunk = Buffer.concat([
      buffer.subarray(0, Math.min(buffer.length, 4096)),
      buffer.subarray(Math.max(0, buffer.length - 4096)),
    ])
      .toString('utf8')
      .toLowerCase();

    const dangerousPatterns = [
      '<script',
      '</script',
      '<?php',
      '<%',
      '<html',
      '<body',
      'onload=',
      'onerror=',
      'javascript:',
      'vbscript:',
    ];

    for (const pattern of dangerousPatterns) {
      if (scanChunk.includes(pattern)) {
        throw new BadRequestException('File contains dangerous executable content or embedded scripts');
      }
    }
  }

  async UploadBase64(dto: UploadBase64Dto): Promise<UploadResponseDto> {
    const rawData = dto.data;
    if (!rawData || typeof rawData !== 'string' || rawData.trim().length === 0) {
      throw new BadRequestException('Empty or missing file data');
    }

    let base64String = rawData.trim();
    let declaredMime = '';

    if (rawData.includes(',')) {
      const parts = rawData.split(',');
      const match = parts[0].match(/:(.*?);/);
      if (match) declaredMime = match[1].trim().toLowerCase();
      base64String = parts[1].trim();
    }

    const isVideo = dto.category === 'video';
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    // Pre-decoding base64 length limit to prevent RAM exhaustion
    const maxBase64Chars = Math.ceil(maxSize * 1.4);

    if (base64String.length > maxBase64Chars) {
      throw new PayloadTooLargeException(
        `File size exceeds maximum allowed limit of ${maxSize / (1024 * 1024)}MB`,
      );
    }

    if (!/^[A-Za-z0-9+/=\r\n]+$/.test(base64String)) {
      throw new BadRequestException('Malformed base64 data');
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64String, 'base64');
    } catch {
      throw new BadRequestException('Malformed base64 data');
    }

    if (buffer.length === 0) {
      throw new BadRequestException('Empty decoded file payload');
    }

    // 1. Validate File Size
    if (buffer.length > maxSize) {
      throw new PayloadTooLargeException(
        `File size exceeds maximum allowed limit of ${maxSize / (1024 * 1024)}MB`,
      );
    }

    // 2. Scan for dangerous executable or script content
    this.scanForDangerousContent(buffer);

    // 3. Strict MIME Detection via Magic Bytes (Fail-closed: NEVER trust declaredMime)
    const detectedMime = this.detectMimeType(buffer);

    if (!detectedMime) {
      throw new UnsupportedMediaTypeException(
        isVideo
          ? 'Invalid video format. Allowed formats: MP4, WebM, MOV'
          : 'Invalid image format. Allowed formats: JPEG, PNG, WebP, GIF',
      );
    }

    if (isVideo) {
      if (!ALLOWED_VIDEO_TYPES[detectedMime]) {
        throw new UnsupportedMediaTypeException(
          'Invalid video format. Allowed formats: MP4, WebM, MOV',
        );
      }
    } else {
      if (!ALLOWED_IMAGE_TYPES[detectedMime]) {
        throw new UnsupportedMediaTypeException(
          'Invalid image format. Allowed formats: JPEG, PNG, WebP, GIF',
        );
      }
    }

    // 4. Spoofed MIME verification: if declared MIME contradicts detected MIME, reject
    if (declaredMime) {
      const normDeclared = declaredMime.replace('image/pjpeg', 'image/jpeg');
      if (normDeclared !== detectedMime) {
        throw new UnsupportedMediaTypeException(
          `MIME type mismatch: Declared '${declaredMime}' does not match detected format '${detectedMime}'`,
        );
      }
    }

    const extension = isVideo
      ? ALLOWED_VIDEO_TYPES[detectedMime]
      : ALLOWED_IMAGE_TYPES[detectedMime];

    // 5. Generate secure, server-side storage filename (Never trust user-supplied filename)
    const uniqueId = uuidv4();
    const folder = dto.category === 'video' ? 'videos' : dto.category === 'logo' ? 'logos' : 'photos';

    const isPrivate = Boolean(dto.is_private && dto.business_id);
    const tenantId = dto.business_id;

    let key: string;
    let publicUrl: string;

    if (isPrivate && tenantId) {
      key = `tenants/${tenantId}/${folder}/${uniqueId}${extension}`;
      publicUrl = `/api/storage/tenants/${tenantId}/${folder}/${uniqueId}${extension}`;
    } else {
      key = `${folder}/${uniqueId}${extension}`;
      publicUrl = `/api/storage/files/${folder}/${uniqueId}${extension}`;
    }

    // 6. Upload to S3 or Local Disk Storage
    if (this.s3Client && this.bucket) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: detectedMime,
          }),
        );

        const url = this.cdnUrl
          ? `${this.cdnUrl.replace(/\/$/, '')}/${key}`
          : `https://${this.bucket}.s3.amazonaws.com/${key}`;

        return {
          url,
          key,
          content_type: detectedMime,
          size: buffer.length,
        };
      } catch (err: any) {
        this.logger.error({ err }, 'Failed to upload file to S3');
        throw new BadRequestException('Failed to upload file to object storage');
      }
    }

    // Local Disk Storage with non-executable permissions (0o644)
    let targetFolder: string;
    if (isPrivate && tenantId) {
      targetFolder = path.join(this.localUploadsDir, 'tenants', tenantId, folder);
    } else {
      targetFolder = path.join(this.localUploadsDir, folder);
    }

    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true, mode: 0o755 });
    }

    const localFilePath = path.join(targetFolder, `${uniqueId}${extension}`);
    fs.writeFileSync(localFilePath, buffer, { mode: 0o644 });

    return {
      url: publicUrl,
      key,
      content_type: detectedMime,
      size: buffer.length,
    };
  }

  /**
   * Retrieves verified local file path for public files.
   * Defends against path traversal, special characters, and unapproved folders.
   */
  getLocalFilePath(folder: string, filename: string): string | null {
    if (!StorageService.ALLOWED_FOLDERS.has(folder)) {
      return null;
    }

    if (!StorageService.SAFE_FILENAME_REGEX.test(filename)) {
      return null;
    }

    const fullPath = path.join(this.localUploadsDir, folder, filename);
    const resolved = path.resolve(fullPath);

    if (!resolved.startsWith(path.resolve(this.localUploadsDir) + path.sep)) {
      return null;
    }

    if (fs.existsSync(resolved)) {
      return resolved;
    }
    return null;
  }

  /**
   * Retrieves verified local file path for tenant-isolated private files.
   * Enforces tenant UUID structure, folder allowlist, and path containment.
   */
  getTenantFilePath(tenantId: string, folder: string, filename: string): string | null {
    if (!StorageService.UUID_REGEX.test(tenantId)) {
      return null;
    }

    if (!StorageService.ALLOWED_FOLDERS.has(folder)) {
      return null;
    }

    if (!StorageService.SAFE_FILENAME_REGEX.test(filename)) {
      return null;
    }

    const fullPath = path.join(this.localUploadsDir, 'tenants', tenantId, folder, filename);
    const resolved = path.resolve(fullPath);

    if (!resolved.startsWith(path.resolve(this.localUploadsDir) + path.sep)) {
      return null;
    }

    if (fs.existsSync(resolved)) {
      return resolved;
    }
    return null;
  }
}
