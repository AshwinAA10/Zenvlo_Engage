import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Req,
  Optional,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../services/auth.service';
import {
  LoginDto,
  SignupDto,
  AuthResponseDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
} from '../models/auth.dto';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Optional() private readonly jwtService?: JwtService,
  ) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new business owner account' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async Signup(@Body() dto: SignupDto): Promise<AuthResponseDto> {
    return this.authService.Signup(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user with email and password' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async Login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.Login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange refresh token for a new access token and rotated refresh token',
  })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or reused refresh token' })
  async RefreshToken(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.RefreshToken(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset link without exposing account existence',
  })
  @ApiResponse({ status: 200, description: 'Generic acknowledgement message' })
  async ForgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.ForgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using valid one-time reset token' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({
    status: 400,
    description: 'Invalid, expired, or reused reset token',
  })
  async ResetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.ResetPassword(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invalidate current session and refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async Logout(@Req() req: any, @Body() body?: { refresh_token?: string }) {
    let userId = req.user?.id || req.user?.sub;

    if (!userId && req.headers?.authorization?.startsWith('Bearer ')) {
      const rawToken = req.headers.authorization.split(' ')[1];
      try {
        const decoded = this.jwtService?.decode(rawToken) as any;
        userId = decoded?.sub;
      } catch {
        // ignore
      }
    }

    if (!userId && body?.refresh_token) {
      try {
        const decoded = this.jwtService?.decode(body.refresh_token) as any;
        userId = decoded?.sub;
      } catch {
        // ignore
      }
    }

    return this.authService.Logout(userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user and business profile' })
  @ApiResponse({ status: 200, description: 'User & business context returned' })
  async GetMe(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.authService.GetMe(userId);
  }
}
