import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Res,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from '../services/storage.service';
import { UploadBase64Dto, UploadResponseDto } from '../models/storage.dto';

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
  @ApiOperation({ summary: 'Upload an image or video file (Base64 payload)' })
  @ApiResponse({ status: 201, type: UploadResponseDto })
  async Upload(@Body() dto: UploadBase64Dto): Promise<UploadResponseDto> {
    return this.storageService.UploadBase64(dto);
  }

  @Get('files/:folder/:filename')
  @ApiOperation({ summary: 'Serve locally stored file' })
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
      res.header('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(buffer);
    } else {
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.end(buffer);
    }
  }
}
