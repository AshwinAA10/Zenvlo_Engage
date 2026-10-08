import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Res,
  Req,
  NotFoundException,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from '../services/storage.service';
import { UploadBase64Dto, UploadResponseDto } from '../models/storage.dto';
import { RateLimit } from '../../RateLimit/decorators/rate-limit.decorator';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { TenantGuard } from '../../../guards/tenant.guard';

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @RateLimit({ limit: 10, ttl: 600, category: 'upload' })
  @ApiOperation({ summary: 'Upload an image or video file (Base64 payload)' })
  @ApiResponse({ status: 201, type: UploadResponseDto })
  async Upload(
    @Body() dto: UploadBase64Dto,
    @Req() req?: any,
  ): Promise<UploadResponseDto> {
    // If authenticated user uploads, attach their verified business_id
    if (req?.user?.business_id && !dto.business_id) {
      dto.business_id = req.user.business_id;
    }

    return this.storageService.UploadBase64(dto);
  }

  @Get('files/:folder/:filename')
  @ApiOperation({ summary: 'Serve locally stored public file' })
  async ServeFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: any,
  ) {
    const filePath = this.storageService.getLocalFilePath(folder, filename);
    if (!filePath) {
      throw new NotFoundException('File not found');
    }

    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    const buffer = fs.readFileSync(filePath);

    if (typeof res.header === 'function') {
      res.header('Content-Type', contentType);
      res.header('X-Content-Type-Options', 'nosniff');
      res.header('Content-Security-Policy', "default-src 'none'");
      res.header('Content-Disposition', 'inline');
      res.header('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(buffer);
    } else {
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'");
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.end(buffer);
    }
  }

  @Get('tenants/:businessId/:folder/:filename')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Serve tenant-isolated file with strict authorization' })
  async ServeTenantFile(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    // Enforce tenant isolation: caller's authenticated business_id must match requested businessId
    const callerBusinessId = req.user?.business_id;
    if (callerBusinessId !== businessId) {
      throw new ForbiddenException('Cross-tenant file access denied');
    }

    const filePath = this.storageService.getTenantFilePath(businessId, folder, filename);
    if (!filePath) {
      throw new NotFoundException('File not found');
    }

    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    const buffer = fs.readFileSync(filePath);

    if (typeof res.header === 'function') {
      res.header('Content-Type', contentType);
      res.header('X-Content-Type-Options', 'nosniff');
      res.header('Content-Security-Policy', "default-src 'none'");
      res.header('Content-Disposition', 'inline');
      res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.send(buffer);
    } else {
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'");
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.end(buffer);
    }
  }
}
