import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({ example: 'owner@salon.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: 'Aarav' })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  first_name?: string;

  @ApiPropertyOptional({ example: 'Sharma' })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  last_name?: string;

  @ApiPropertyOptional({ example: 'Green Orchid Salon & Spa' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  business_name?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'owner@salon.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(6)
  password: string;
}

export class AuthResponseDto {
  @ApiProperty()
  access_token: string;

  @ApiProperty()
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };

  @ApiPropertyOptional()
  business?: {
    id: string;
    name: string;
    slug: string;
    category: string;
    logo_url: string | null;
  } | null;
}
