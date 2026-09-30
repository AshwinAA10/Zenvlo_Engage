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
      fs.mkdirSync(this.localUploadsDir, { recursive: true });
    }
  }

  /**
   * Validates binary buffer magic bytes to prevent MIME spoofing.
   */
  private detectMimeType(buffer: Buffer): string | null {
    if (buffer.length < 12) return null;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return 'image/png';
    }

    // GIF: GIF87a or GIF89a
    if (
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38
    ) {
      return 'image/gif';
    }

    // WebP: RIFF....WEBP
    if (
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return 'image/webp';
    }

    // WebM: 1A 45 DF A3
    if (
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3
    ) {
      return 'video/webm';
    }

    // MP4 / MOV: check for 'ftyp'
    const box = buffer.toString('ascii', 4, 8);
    if (box === 'ftyp' || box === 'moov') {
      const brand = buffer.toString('ascii', 8, 12);
      if (brand === 'qt  ') return 'video/quicktime';
      return 'video/mp4';
    }

    return null;
  }

  async UploadBase64(dto: UploadBase64Dto): Promise<UploadResponseDto> {
    const rawData = dto.data;
    let base64String = rawData;
    let declaredMime = '';

    if (rawData.includes(',')) {
      const parts = rawData.split(',');
      const match = parts[0].match(/:(.*?);/);
      if (match) declaredMime = match[1];
      base64String = parts[1];
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64String, 'base64');
    } catch {
      throw new BadRequestException('Malformed base64 data');
    }

    // 1. Validate File Size
    const isVideo = dto.category === 'video';
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

    if (buffer.length > maxSize) {
      throw new PayloadTooLargeException(
        `File size exceeds maximum allowed limit of ${maxSize / (1024 * 1024)}MB`,
      );
    }

    // 2. Validate MIME Type via Magic Bytes (Never trust frontend blindly)
    const detectedMime = this.detectMimeType(buffer) || declaredMime;

    if (isVideo) {
      if (!detectedMime || !ALLOWED_VIDEO_TYPES[detectedMime]) {
        throw new UnsupportedMediaTypeException(
          'Invalid video format. Allowed formats: MP4, WebM, MOV',
        );
      }
    } else {
      if (!detectedMime || !ALLOWED_IMAGE_TYPES[detectedMime]) {
        throw new UnsupportedMediaTypeException(
          'Invalid image format. Allowed formats: JPEG, PNG, WebP, GIF',
        );
      }
    }

    const extension = isVideo
      ? ALLOWED_VIDEO_TYPES[detectedMime]
      : ALLOWED_IMAGE_TYPES[detectedMime];

    const uniqueId = uuidv4();
    const folder = dto.category === 'video' ? 'videos' : dto.category === 'logo' ? 'logos' : 'photos';
    const key = `${folder}/${uniqueId}${extension}`;

    // 3. Upload to S3 or Local Fallback
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

    // Local Disk Storage Fallback
    const targetFolder = path.join(this.localUploadsDir, folder);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const localFilePath = path.join(targetFolder, `${uniqueId}${extension}`);
    fs.writeFileSync(localFilePath, buffer);

    const publicUrl = `/api/storage/files/${folder}/${uniqueId}${extension}`;

    return {
      url: publicUrl,
      key,
      content_type: detectedMime,
      size: buffer.length,
    };
  }

  getLocalFilePath(folder: string, filename: string): string | null {
    // Path traversal prevention
    const sanitizedFilename = path.basename(filename);
    const sanitizedFolder = path.basename(folder);
    const fullPath = path.join(this.localUploadsDir, sanitizedFolder, sanitizedFilename);

    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
    return null;
  }
}
