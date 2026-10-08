import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../../User/entities/user.entity';
import { Business } from '../../Business/entities/business.entity';
import { BusinessService } from '../../Business/services/business.service';
import {
  LoginDto,
  SignupDto,
  AuthResponseDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
} from '../models/auth.dto';
import { EVENT_AUDIT_RECORD } from '../../../common/constants';
import { AuditRecordEvent } from '../../../events/audit.event';

// Dummy bcrypt hash for timing attack mitigation on unknown email lookup
const DUMMY_HASH = '$2b$12$e8Yk8u2zC1aJ3K8m9N0PVuT4wX2yZ1aB3c4d5e6f7g8h9i0j1k2l3';

@Injectable()
export class AuthService {
  private readonly saltRounds = 12;

  constructor(
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
    private readonly businessService: BusinessService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  private getJwtSecret(): string {
    return (
      this.configService?.get<string>('JWT_SECRET') ||
      process.env.JWT_SECRET ||
      'super_secret_jwt_key_zenvlo_engage_production_change_me'
    );
  }

  private getRefreshSecret(): string {
    return (
      this.configService?.get<string>('JWT_REFRESH_SECRET') ||
      process.env.JWT_REFRESH_SECRET ||
      this.getJwtSecret()
    );
  }

  private createTokens(
    user: User,
    businessId: string | null,
  ): { access_token: string; refresh_token: string } {
    const tokenVersion = user.token_version || 1;

    const accessPayload = {
      sub: user.id,
      email: user.email,
      business_id: businessId,
      token_version: tokenVersion,
    };

    const accessExpiration =
      this.configService?.get<string>('JWT_EXPIRATION') ||
      process.env.JWT_EXPIRATION ||
      '15m';

    const access_token = this.jwtService.sign(accessPayload, {
      expiresIn: accessExpiration,
    });

    const refreshPayload = {
      sub: user.id,
      token_version: tokenVersion,
      jti: crypto.randomBytes(16).toString('hex'),
      type: 'refresh',
    };

    const refreshExpiration =
      this.configService?.get<string>('JWT_REFRESH_EXPIRATION') ||
      process.env.JWT_REFRESH_EXPIRATION ||
      '7d';

    const refresh_token = this.jwtService.sign(refreshPayload, {
      secret: this.getRefreshSecret(),
      expiresIn: refreshExpiration,
    });

    return { access_token, refresh_token };
  }

  async ValidateUser(email: string, pass: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.createQueryBuilder('user')
      .addSelect(['user.password_hash', 'user.token_version', 'user.refresh_token_hash'])
      .where('LOWER(user.email) = LOWER(:email)', { email: normalizedEmail })
      .andWhere('user.status = 1')
      .getOne();

    if (!user) {
      // Mitigate timing attack with simulated bcrypt compare
      await bcrypt.compare(pass, DUMMY_HASH).catch(() => {});
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(pass, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }

  async Signup(dto: SignupDto): Promise<AuthResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await User.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const password_hash = await bcrypt.hash(dto.password, this.saltRounds);

    const user = new User();
    user.email = normalizedEmail;
    user.password_hash = password_hash;
    user.first_name = dto.first_name?.trim() || null;
    user.last_name = dto.last_name?.trim() || null;
    user.token_version = 1;
    await user.save();

    let business: Business | null = null;
    if (dto.business_name && dto.business_name.trim().length > 0) {
      business = await this.businessService.InsertOnboarding(user.id, {
        name: dto.business_name.trim(),
      });
    }

    const businessId = business ? business.id : null;
    const { access_token, refresh_token } = this.createTokens(user, businessId);

    // Hash refresh token at rest
    user.refresh_token_hash = crypto
      .createHash('sha256')
      .update(refresh_token)
      .digest('hex');
    await user.save();

    if (business) {
      this.eventEmitter.emit(
        EVENT_AUDIT_RECORD,
        new AuditRecordEvent(
          business.id,
          user.id,
          'USER_SIGNUP',
          'User',
          user.id,
          { email: user.email, business_name: business.name },
        ),
      );
    }

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      business: business
        ? {
            id: business.id,
            name: business.name,
            slug: business.slug,
            category: business.category,
            logo_url: business.logo_url,
          }
        : null,
    };
  }

  async Login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.ValidateUser(dto.email, dto.password);

    const business = await Business.findOne({
      where: { user_id: user.id, status: 1 },
      order: { created_on: 'ASC' },
    });

    const businessId = business ? business.id : null;
    const { access_token, refresh_token } = this.createTokens(user, businessId);

    // Store hashed refresh token at rest
    user.refresh_token_hash = crypto
      .createHash('sha256')
      .update(refresh_token)
      .digest('hex');
    await user.save();

    if (business) {
      this.eventEmitter.emit(
        EVENT_AUDIT_RECORD,
        new AuditRecordEvent(
          business.id,
          user.id,
          'USER_LOGIN',
          'User',
          user.id,
          { email: user.email },
        ),
      );
    }

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      business: business
        ? {
            id: business.id,
            name: business.name,
            slug: business.slug,
            category: business.category,
            logo_url: business.logo_url,
          }
        : null,
    };
  }

  async RefreshToken(dto: RefreshTokenDto): Promise<AuthResponseDto> {
    const rawRefreshToken = dto.refresh_token ? dto.refresh_token.trim() : '';
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    let decoded: any;
    try {
      decoded = this.jwtService.verify(rawRefreshToken, {
        secret: this.getRefreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!decoded || decoded.type !== 'refresh' || !decoded.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await User.createQueryBuilder('user')
      .addSelect(['user.refresh_token_hash', 'user.token_version'])
      .where('user.id = :id', { id: decoded.sub })
      .andWhere('user.status = 1')
      .getOne();

    if (!user) {
      throw new UnauthorizedException('User account inactive or not found');
    }

    // Session revocation check
    if (decoded.token_version !== undefined && user.token_version !== decoded.token_version) {
      throw new UnauthorizedException('Session has been revoked');
    }

    const incomingHash = crypto
      .createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');

    // REUSE DETECTION:
    // If presented token does not match the stored hash for this user session,
    // a previously rotated token is being reused! Revoke ALL sessions immediately.
    if (!user.refresh_token_hash || user.refresh_token_hash !== incomingHash) {
      user.token_version = (user.token_version || 1) + 1;
      user.refresh_token_hash = null;
      await user.save();

      this.eventEmitter.emit(
        EVENT_AUDIT_RECORD,
        new AuditRecordEvent(
          user.id,
          user.id,
          'REFRESH_TOKEN_REUSE_DETECTED',
          'User',
          user.id,
          {
            email: user.email,
            reason: 'All sessions revoked due to detected refresh token reuse attempt',
          },
        ),
      );

      throw new UnauthorizedException(
        'Refresh token reuse detected. All sessions have been revoked for security.',
      );
    }

    // Token Rotation: issue brand new access token & new refresh token
    const business = await Business.findOne({
      where: { user_id: user.id, status: 1 },
      order: { created_on: 'ASC' },
    });

    const businessId = business ? business.id : null;
    const { access_token, refresh_token } = this.createTokens(user, businessId);

    user.refresh_token_hash = crypto
      .createHash('sha256')
      .update(refresh_token)
      .digest('hex');
    await user.save();

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      business: business
        ? {
            id: business.id,
            name: business.name,
            slug: business.slug,
            category: business.category,
            logo_url: business.logo_url,
          }
        : null,
    };
  }

  async ForgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ status: string; message: string }> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await User.createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: normalizedEmail })
      .andWhere('user.status = 1')
      .getOne();

    // Constant response preventing account enumeration
    const genericResponse = {
      status: 'SUCCESS',
      message:
        'If this email address is registered, a password reset link has been sent.',
    };

    if (!user) {
      // Simulate work to prevent side-channel timing enumeration
      await bcrypt.compare('dummy_enumeration_timing', DUMMY_HASH).catch(() => {});
      return genericResponse;
    }

    // Secure random token (32 bytes = 64 hex characters)
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawResetToken)
      .digest('hex');

    // 15-minute token TTL
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    user.password_reset_token_hash = tokenHash;
    user.password_reset_expires_at = expiresAt;
    await user.save();

    this.eventEmitter.emit(
      EVENT_AUDIT_RECORD,
      new AuditRecordEvent(
        user.id,
        user.id,
        'PASSWORD_RESET_REQUESTED',
        'User',
        user.id,
        { email: user.email },
      ),
    );

    return genericResponse;
  }

  async ResetPassword(
    dto: ResetPasswordDto,
  ): Promise<{ status: string; message: string }> {
    const rawToken = dto.token ? dto.token.trim() : '';
    if (!rawToken) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const user = await User.createQueryBuilder('user')
      .addSelect([
        'user.password_reset_token_hash',
        'user.password_reset_expires_at',
        'user.password_hash',
        'user.token_version',
      ])
      .where('user.password_reset_token_hash = :hash', { hash: tokenHash })
      .andWhere('user.status = 1')
      .getOne();

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    if (
      !user.password_reset_expires_at ||
      user.password_reset_expires_at.getTime() < Date.now()
    ) {
      // Expired: invalidate immediately
      user.password_reset_token_hash = null;
      user.password_reset_expires_at = null;
      await user.save();
      throw new BadRequestException('Invalid or expired password reset token');
    }

    // 1. One-time use: invalidate reset token immediately
    user.password_reset_token_hash = null;
    user.password_reset_expires_at = null;

    // 2. Hash new password with 12 bcrypt salt rounds
    user.password_hash = await bcrypt.hash(dto.new_password, this.saltRounds);

    // 3. Invalidate all active sessions & refresh tokens (bump token_version)
    user.token_version = (user.token_version || 1) + 1;
    user.refresh_token_hash = null;
    await user.save();

    this.eventEmitter.emit(
      EVENT_AUDIT_RECORD,
      new AuditRecordEvent(
        user.id,
        user.id,
        'PASSWORD_RESET_SUCCESS',
        'User',
        user.id,
        { email: user.email },
      ),
    );

    return {
      status: 'SUCCESS',
      message: 'Password has been reset successfully. Please log in with your new password.',
    };
  }

  async Logout(userId?: string): Promise<{ status: string; message: string }> {
    if (userId) {
      const user = await User.findOne({ where: { id: userId, status: 1 } });
      if (user) {
        user.token_version = (user.token_version || 1) + 1;
        user.refresh_token_hash = null;
        await user.save();

        this.eventEmitter.emit(
          EVENT_AUDIT_RECORD,
          new AuditRecordEvent(
            user.id,
            user.id,
            'USER_LOGOUT',
            'User',
            user.id,
            { email: user.email },
          ),
        );
      }
    }
    return { status: 'SUCCESS', message: 'Logged out successfully' };
  }

  async GetMe(userId: string) {
    const user = await User.findOne({ where: { id: userId, status: 1 } });
    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const business = await Business.findOne({
      where: { user_id: user.id, status: 1 },
      order: { created_on: 'ASC' },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_url: user.avatar_url,
      },
      business: business
        ? {
            id: business.id,
            name: business.name,
            slug: business.slug,
            category: business.category,
            logo_url: business.logo_url,
            phone: business.phone,
            website: business.website,
            location: business.location,
          }
        : null,
    };
  }
}
