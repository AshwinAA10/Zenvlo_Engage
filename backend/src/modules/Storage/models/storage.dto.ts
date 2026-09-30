import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadBase64Dto {
  @ApiProperty({
    description: 'Base64 encoded file data (with or without data URL prefix)',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
  })
  @IsString()
  @IsNotEmpty()
  data: string;

  @ApiProperty({ description: 'Original filename', example: 'review-photo.jpg' })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiPropertyOptional({
    description: 'Category of upload',
    enum: ['photo', 'video', 'logo'],
    default: 'photo',
  })
  @IsIn(['photo', 'video', 'logo'])
  @IsOptional()
  category?: 'photo' | 'video' | 'logo' = 'photo';
}

export class UploadResponseDto {
  @ApiProperty({ description: 'Publicly accessible URL to the uploaded file' })
  url: string;

  @ApiProperty({ description: 'File key or name in storage' })
  key: string;

  @ApiProperty({ description: 'Detected MIME type' })
  content_type: string;

  @ApiProperty({ description: 'File size in bytes' })
  size: number;
}
