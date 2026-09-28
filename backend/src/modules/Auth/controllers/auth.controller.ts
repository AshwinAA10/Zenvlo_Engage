import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { LoginDto, SignupDto, AuthResponseDto } from '../models/auth.dto';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invalidate current session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async Logout() {
    return this.authService.Logout();
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
