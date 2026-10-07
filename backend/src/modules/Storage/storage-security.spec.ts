import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from './services/storage.service';
import { StorageController } from './controllers/storage.controller';
import { RateLimitGuard } from '../RateLimit/guards/rate-limit.guard';
import { RateLimitService } from '../RateLimit/services/rate-limit.service';
import { IpResolverService } from '../RateLimit/services/ip-resolver.service';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { TenantGuard } from '../../guards/tenant.guard';

describe('Public Upload Security (Phase 9D)', () => {
  let service: StorageService;
  let controller: StorageController;
  let rateLimitGuard: RateLimitGuard;

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'S3_REGION') return 'ap-south-1';
      return null;
    }),
  };

  // Valid file headers
  const VALID_PNG_BYTES = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ]);
  const VALID_JPEG_BYTES = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);
  const VALID_GIF_BYTES = Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  ]);
  const VALID_WEBP_BYTES = Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);
  const VALID_MP4_BYTES = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
  ]);

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [
        StorageService,
        RateLimitGuard,
        RateLimitService,
        IpResolverService,
        Reflector,
        { provide: PinoLogger, useValue: mockLogger },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: ClsService,
          useValue: { isActive: () => false, set: jest.fn(), get: jest.fn() },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .compile();

    service = module.get<StorageService>(StorageService);
    controller = module.get<StorageController>(StorageController);
    rateLimitGuard = module.get<RateLimitGuard>(RateLimitGuard);
  });

  describe('1. Request & File Size Limits', () => {
    it('should reject file payload exceeding individual image size limit (5MB)', async () => {
      // 5.5MB JPEG buffer
      const oversizedBuffer = Buffer.alloc(5.5 * 1024 * 1024);
      oversizedBuffer[0] = 0xff;
      oversizedBuffer[1] = 0xd8;
      oversizedBuffer[2] = 0xff;

      await expect(
        service.UploadBase64({
          data: oversizedBuffer.toString('base64'),
          filename: 'heavy-photo.jpg',
          category: 'photo',
        }),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('should reject file payload exceeding individual video size limit (30MB)', async () => {
      // 31MB MP4 buffer
      const oversizedVideo = Buffer.alloc(31 * 1024 * 1024);
      oversizedVideo.set(VALID_MP4_BYTES, 0);

      await expect(
        service.UploadBase64({
          data: oversizedVideo.toString('base64'),
          filename: 'huge-video.mp4',
          category: 'video',
        }),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('should reject oversized request before decoding if base64 string exceeds boundary', async () => {
      // 10MB base64 string for a photo (photo ceiling is 5MB ~ 7MB base64)
      const oversizedBase64 = 'A'.repeat(8 * 1024 * 1024);

      await expect(
        service.UploadBase64({
          data: oversizedBase64,
          filename: 'overflow.jpg',
          category: 'photo',
        }),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('should reject empty or missing file payload', async () => {
      await expect(
        service.UploadBase64({
          data: '   ',
          filename: 'empty.jpg',
          category: 'photo',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Strict File Validation & Magic Bytes', () => {
    it('should allow valid JPEG, PNG, GIF, and WebP images', async () => {
      // JPEG
      const jpegRes = await service.UploadBase64({
        data: `data:image/jpeg;base64,${VALID_JPEG_BYTES.toString('base64')}`,
        filename: 'real.jpg',
        category: 'photo',
      });
      expect(jpegRes.content_type).toBe('image/jpeg');

      // PNG
      const pngRes = await service.UploadBase64({
        data: `data:image/png;base64,${VALID_PNG_BYTES.toString('base64')}`,
        filename: 'real.png',
        category: 'photo',
      });
      expect(pngRes.content_type).toBe('image/png');

      // GIF
      const gifRes = await service.UploadBase64({
        data: `data:image/gif;base64,${VALID_GIF_BYTES.toString('base64')}`,
        filename: 'real.gif',
        category: 'photo',
      });
      expect(gifRes.content_type).toBe('image/gif');

      // WebP
      const webpRes = await service.UploadBase64({
        data: `data:image/webp;base64,${VALID_WEBP_BYTES.toString('base64')}`,
        filename: 'real.webp',
        category: 'photo',
      });
      expect(webpRes.content_type).toBe('image/webp');
    });

    it('should allow valid MP4 video upload', async () => {
      const mp4Res = await service.UploadBase64({
        data: `data:video/mp4;base64,${VALID_MP4_BYTES.toString('base64')}`,
        filename: 'testimonial.mp4',
        category: 'video',
      });
      expect(mp4Res.content_type).toBe('video/mp4');
      expect(mp4Res.key).toContain('videos/');
    });

    it('should reject spoofed MIME: declared image/png but payload is plain text', async () => {
      const fakePng = Buffer.from('Hello this is not a PNG file');

      await expect(
        service.UploadBase64({
          data: `data:image/png;base64,${fakePng.toString('base64')}`,
          filename: 'malicious.png',
          category: 'photo',
        }),
      ).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('should reject spoofed MIME: declared image/jpeg but payload is PNG binary', async () => {
      await expect(
        service.UploadBase64({
          data: `data:image/jpeg;base64,${VALID_PNG_BYTES.toString('base64')}`,
          filename: 'mismatch.jpg',
          category: 'photo',
        }),
      ).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('should reject executable file types (PE/MZ)', async () => {
      // Windows executable header MZ (0x4D, 0x5A)
      const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);

      await expect(
        service.UploadBase64({
          data: `data:application/octet-stream;base64,${exeBuffer.toString('base64')}`,
          filename: 'payload.exe',
          category: 'photo',
        }),
      ).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('should reject Linux ELF executable binary', async () => {
      // Linux ELF header (0x7F, 0x45, 0x4C, 0x46)
      const elfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]);

      await expect(
        service.UploadBase64({
          data: `data:application/octet-stream;base64,${elfBuffer.toString('base64')}`,
          filename: 'backdoor',
          category: 'photo',
        }),
      ).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('should reject shell scripts (#!/bin/)', async () => {
      const shBuffer = Buffer.from('#!/bin/bash\nrm -rf /');

      await expect(
        service.UploadBase64({
          data: `data:text/x-shellscript;base64,${shBuffer.toString('base64')}`,
          filename: 'exploit.sh',
          category: 'photo',
        }),
      ).rejects.toThrow(UnsupportedMediaTypeException);
    });
  });

  describe('3. Content Validation & Script Injection Defense', () => {
    it('should reject image containing embedded <script> tags (Stored XSS)', async () => {
      // JPEG header with embedded script payload
      const xssBuffer = Buffer.concat([
        VALID_JPEG_BYTES,
        Buffer.from('<script>alert("XSS")</script>'),
      ]);

      await expect(
        service.UploadBase64({
          data: `data:image/jpeg;base64,${xssBuffer.toString('base64')}`,
          filename: 'xss.jpg',
          category: 'photo',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject image containing embedded PHP code (Webshell)', async () => {
      const phpShellBuffer = Buffer.concat([
        VALID_PNG_BYTES,
        Buffer.from('<?php system($_GET["c"]); ?>'),
      ]);

      await expect(
        service.UploadBase64({
          data: `data:image/png;base64,${phpShellBuffer.toString('base64')}`,
          filename: 'shell.png',
          category: 'photo',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject malformed base64 containing illegal characters', async () => {
      await expect(
        service.UploadBase64({
          data: 'not_valid_base64_!!!***@@@',
          filename: 'bad.jpg',
          category: 'photo',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('4. Filename Security & Path Traversal Prevention', () => {
    it('should never use client-supplied filename for storage key (generates server UUID)', async () => {
      const result = await service.UploadBase64({
        data: `data:image/png;base64,${VALID_PNG_BYTES.toString('base64')}`,
        filename: '../../../etc/passwd.png',
        category: 'photo',
      });

      // Key must NOT contain ../ or etc
      expect(result.key).not.toContain('..');
      expect(result.key).not.toContain('etc');
      expect(result.key).not.toContain('passwd');
      // Key must follow photos/<uuid>.png pattern
      expect(result.key).toMatch(/^photos\/[0-9a-f-]{36}\.png$/);
    });

    it('should block directory traversal in getLocalFilePath', () => {
      // Direct traversal attempt
      expect(service.getLocalFilePath('..', 'test.jpg')).toBeNull();
      expect(service.getLocalFilePath('photos', '../../etc/passwd')).toBeNull();
      expect(service.getLocalFilePath('photos', '..\\..\\boot.ini')).toBeNull();
    });

    it('should reject unapproved folder access in getLocalFilePath', () => {
      expect(service.getLocalFilePath('system', '550e8400-e29b-41d4-a716-446655440000.jpg')).toBeNull();
      expect(service.getLocalFilePath('database', '550e8400-e29b-41d4-a716-446655440000.jpg')).toBeNull();
    });

    it('should reject non-UUID filenames in getLocalFilePath', () => {
      expect(service.getLocalFilePath('photos', 'arbitrary-file.jpg')).toBeNull();
      expect(service.getLocalFilePath('photos', 'script.js')).toBeNull();
    });

    it('should generate distinct non-colliding UUID filenames for duplicate uploads', async () => {
      const res1 = await service.UploadBase64({
        data: `data:image/png;base64,${VALID_PNG_BYTES.toString('base64')}`,
        filename: 'same-name.png',
        category: 'photo',
      });

      const res2 = await service.UploadBase64({
        data: `data:image/png;base64,${VALID_PNG_BYTES.toString('base64')}`,
        filename: 'same-name.png',
        category: 'photo',
      });

      expect(res1.key).not.toBe(res2.key);
      expect(res1.url).not.toBe(res2.url);
    });
  });

  describe('5. Tenant Isolation & Access Controls', () => {
    it('should store tenant-isolated private files under tenant-specific path', async () => {
      const tenantId = '11111111-1111-4111-8111-111111111111';

      const res = await service.UploadBase64({
        data: `data:image/png;base64,${VALID_PNG_BYTES.toString('base64')}`,
        filename: 'private-doc.png',
        category: 'photo',
        business_id: tenantId,
        is_private: true,
      });

      expect(res.key).toContain(`tenants/${tenantId}/photos/`);
      expect(res.url).toContain(`/api/storage/tenants/${tenantId}/photos/`);
    });

    it('should allow Tenant A user to access Tenant A private files', async () => {
      const tenantId = '22222222-2222-4222-8222-222222222222';

      // 1. Upload private file for Tenant A
      const uploadRes = await service.UploadBase64({
        data: `data:image/jpeg;base64,${VALID_JPEG_BYTES.toString('base64')}`,
        filename: 'contract.jpg',
        category: 'photo',
        business_id: tenantId,
        is_private: true,
      });

      const filename = path.basename(uploadRes.url);

      // 2. Request as Tenant A user
      const req = { user: { business_id: tenantId } };
      const resHeaders: Record<string, string> = {};
      const res = {
        header: jest.fn((k, v) => (resHeaders[k] = v)),
        send: jest.fn(),
      };

      await controller.ServeTenantFile(tenantId, 'photos', filename, req, res);

      expect(res.send).toHaveBeenCalled();
      expect(resHeaders['X-Content-Type-Options']).toBe('nosniff');
      expect(resHeaders['Content-Security-Policy']).toBe("default-src 'none'");
    });

    it('should REJECT Tenant B user attempting to access Tenant A files (Cross-Tenant Protection)', async () => {
      const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

      // Upload file for Tenant A
      const uploadRes = await service.UploadBase64({
        data: `data:image/png;base64,${VALID_PNG_BYTES.toString('base64')}`,
        filename: 'secret-a.png',
        category: 'photo',
        business_id: tenantA,
        is_private: true,
      });

      const filename = path.basename(uploadRes.url);

      // User from Tenant B attempts to fetch Tenant A's file
      const attackerReq = { user: { business_id: tenantB } };
      const res = { header: jest.fn(), send: jest.fn() };

      await expect(
        controller.ServeTenantFile(tenantA, 'photos', filename, attackerReq, res),
      ).rejects.toThrow(ForbiddenException);

      expect(res.send).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent file in tenant storage', async () => {
      const tenantId = '33333333-3333-4333-8333-333333333333';
      const req = { user: { business_id: tenantId } };
      const res = { header: jest.fn(), send: jest.fn() };

      await expect(
        controller.ServeTenantFile(
          tenantId,
          'photos',
          '00000000-0000-4000-8000-000000000000.jpg',
          req,
          res,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('6. Security Headers on Public File Download', () => {
    it('should set X-Content-Type-Options and CSP headers when serving public files', async () => {
      const uploadRes = await service.UploadBase64({
        data: `data:image/jpeg;base64,${VALID_JPEG_BYTES.toString('base64')}`,
        filename: 'public-photo.jpg',
        category: 'photo',
      });

      const filename = path.basename(uploadRes.url);
      const resHeaders: Record<string, string> = {};
      const res = {
        header: jest.fn((k, v) => (resHeaders[k] = v)),
        send: jest.fn(),
      };

      await controller.ServeFile('photos', filename, res);

      expect(res.send).toHaveBeenCalled();
      expect(resHeaders['X-Content-Type-Options']).toBe('nosniff');
      expect(resHeaders['Content-Security-Policy']).toBe("default-src 'none'");
      expect(resHeaders['Content-Disposition']).toBe('inline');
      expect(resHeaders['Content-Type']).toBe('image/jpeg');
    });
  });
});
