import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { validate } from 'class-validator';
import { AuthService } from './services/auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../User/entities/user.entity';
import { Business } from '../Business/entities/business.entity';
import { BusinessService } from '../Business/services/business.service';
import { RateLimitService } from '../RateLimit/services/rate-limit.service';
import {
  SignupDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
} from './models/auth.dto';
import { ClsService } from 'nestjs-cls';

describe('Auth Security Hardening (Phase 9E)', () => {
  let authService: AuthService;
  let jwtStrategy: JwtStrategy;
  let jwtService: JwtService;
  let rateLimitService: RateLimitService;
  let eventEmitter: EventEmitter2;

  const mockUser = {
    id: 'usr-sec-101',
    email: 'admin@zenvlo-secure.com',
    password_hash: '',
    token_version: 1,
    refresh_token_hash: null as string | null,
    password_reset_token_hash: null as string | null,
    password_reset_expires_at: null as Date | null,
    status: 1,
    first_name: 'Security',
    last_name: 'Lead',
    save: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    // Generate valid bcrypt hash for mockUser with 12 rounds
    mockUser.password_hash = await bcrypt.hash('CorrectPassword123!', 12);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    jwtService = new JwtService({
      secret: 'test_super_secure_jwt_secret_zenvlo_engage_phase9e',
    });

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const mockBusinessService = {
      InsertOnboarding: jest.fn().mockResolvedValue({
        id: 'bus-101',
        name: 'Secure Enterprise',
        slug: 'secure-enterprise',
        category: 'Services',
        logo_url: null,
      }),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'test_super_secure_jwt_secret_zenvlo_engage_phase9e';
        if (key === 'JWT_REFRESH_SECRET') return 'test_super_secure_refresh_secret_phase9e';
        if (key === 'JWT_EXPIRATION') return '15m';
        if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
        return undefined;
      }),
    } as any;

    const mockClsService = {
      isActive: jest.fn().mockReturnValue(false),
      set: jest.fn(),
    } as any;

    authService = new AuthService(
      jwtService,
      mockEventEmitter as any,
      mockBusinessService as any,
      mockConfigService,
    );

    jwtStrategy = new JwtStrategy(mockConfigService, mockClsService);
    rateLimitService = new RateLimitService();
    eventEmitter = mockEventEmitter as any;
  });

  describe('1. Forgot-Password & Account Enumeration Prevention', () => {
    it('should return identical success message for existing registered user without exposing details', async () => {
      const existingUser = {
        ...mockUser,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'createQueryBuilder').mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(existingUser),
      } as any);

      const dto: ForgotPasswordDto = { email: 'admin@zenvlo-secure.com' };
      const response = await authService.ForgotPassword(dto);

      expect(response).toEqual({
        status: 'SUCCESS',
        message: 'If this email address is registered, a password reset link has been sent.',
      });

      // Token must be hashed at rest with SHA-256 and expires in ~15 mins
      expect(existingUser.password_reset_token_hash).toBeDefined();
      expect(existingUser.password_reset_token_hash?.length).toBe(64); // SHA-256 hex is 64 chars
      expect(existingUser.password_reset_expires_at).toBeDefined();
      expect(existingUser.password_reset_expires_at!.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
      expect(existingUser.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'audit.record',
        expect.objectContaining({ action: 'PASSWORD_RESET_REQUESTED' }),
      );
    });

    it('should return the exact same generic message for non-existent email (no enumeration)', async () => {
      jest.spyOn(User, 'createQueryBuilder').mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      } as any);

      const dto: ForgotPasswordDto = { email: 'unregistered-stranger@nowhere.com' };
      const response = await authService.ForgotPassword(dto);

      expect(response).toEqual({
        status: 'SUCCESS',
        message: 'If this email address is registered, a password reset link has been sent.',
      });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('2. Password Reset Lifecycle & Invalidation', () => {
    it('should successfully reset password, hash with bcrypt 12, invalidate reset token, and increment token_version', async () => {
      const rawToken = 'plain_text_reset_token_64_bytes_entropy_abc123';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const userWithResetToken = {
        ...mockUser,
        password_reset_token_hash: tokenHash,
        password_reset_expires_at: new Date(Date.now() + 10 * 60 * 1000), // valid for 10 more mins
        token_version: 1,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'createQueryBuilder').mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(userWithResetToken),
      } as any);

      const dto: ResetPasswordDto = {
        token: rawToken,
        new_password: 'NewStrongPassword456!',
      };

      const result = await authService.ResetPassword(dto);

      expect(result.status).toBe('SUCCESS');
      // 1. One-time use: reset token must be cleared
      expect(userWithResetToken.password_reset_token_hash).toBeNull();
      expect(userWithResetToken.password_reset_expires_at).toBeNull();

      // 2. Token version must be incremented to revoke existing sessions
      expect(userWithResetToken.token_version).toBe(2);
      expect(userWithResetToken.refresh_token_hash).toBeNull();

      // 3. New password must be hashed with bcrypt
      const isNewPasswordValid = await bcrypt.compare('NewStrongPassword456!', userWithResetToken.password_hash);
      expect(isNewPasswordValid).toBe(true);

      // Audit event emitted
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'audit.record',
        expect.objectContaining({ action: 'PASSWORD_RESET_SUCCESS' }),
      );
    });

    it('should reject expired reset token and invalidate it immediately', async () => {
      const rawToken = 'expired_raw_reset_token_123';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const userWithExpiredToken = {
        ...mockUser,
        password_reset_token_hash: tokenHash,
        password_reset_expires_at: new Date(Date.now() - 60 * 1000), // expired 1 min ago
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'createQueryBuilder').mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(userWithExpiredToken),
      } as any);

      const dto: ResetPasswordDto = {
        token: rawToken,
        new_password: 'NewStrongPassword456!',
      };

      await expect(authService.ResetPassword(dto)).rejects.toThrow(BadRequestException);
      expect(userWithExpiredToken.password_reset_token_hash).toBeNull();
      expect(userWithExpiredToken.password_reset_expires_at).toBeNull();
      expect(userWithExpiredToken.save).toHaveBeenCalled();
    });

    it('should reject invalid or non-existent reset token', async () => {
      jest.spyOn(User, 'createQueryBuilder').mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      } as any);

      const dto: ResetPasswordDto = {
        token: 'completely_forged_or_tampered_token',
        new_password: 'NewStrongPassword456!',
      };

      await expect(authService.ResetPassword(dto)).rejects.toThrow(BadRequestException);
    });

    it('should reject reused reset token because token was cleared after first use', async () => {
      // First use succeeded and set password_reset_token_hash to null
      jest.spyOn(User, 'createQueryBuilder').mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null), // no user has this token anymore
      } as any);

      const dto: ResetPasswordDto = {
        token: 'already_used_token_abc',
        new_password: 'AnotherPassword789!',
      };

      await expect(authService.ResetPassword(dto)).rejects.toThrow('Invalid or expired password reset token');
    });
  });

  describe('3. Password Complexity Policy Validation', () => {
    it('should reject passwords that fail strong complexity requirements', async () => {
      const weakPasswords = [
        'short1!', // < 8 characters
        'alllowercase123!', // No uppercase
        'ALLUPPERCASE123!', // No lowercase
        'NoNumbersHere!', // No numbers
        'NoSpecialCharacters123', // No special characters
      ];

      for (const pass of weakPasswords) {
        const dto = new ResetPasswordDto();
        dto.token = 'valid_token_123';
        dto.new_password = pass;

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('matches');
      }
    });

    it('should accept passwords satisfying all complexity requirements', async () => {
      const strongPasswords = [
        'Zenvlo@Engage2026',
        'Strong#P4ssw0rd!',
        'A1b2C3d4!xyz',
      ];

      for (const pass of strongPasswords) {
        const dto = new ResetPasswordDto();
        dto.token = 'valid_token_123';
        dto.new_password = pass;

        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('4. Token Rotation & Refresh Token Reuse Detection', () => {
    it('should issue new access token and rotated refresh token on legitimate refresh', async () => {
      const user = {
        ...mockUser,
        token_version: 1,
        refresh_token_hash: '',
        save: jest.fn().mockResolvedValue(true),
      };

      // Create a valid refresh token signed with refresh secret
      const rawRefreshToken = jwtService.sign(
        { sub: user.id, token_version: 1, jti: 'jti-initial', type: 'refresh' },
        { secret: 'test_super_secure_refresh_secret_phase9e', expiresIn: '7d' },
      );

      // Store hash at rest
      user.refresh_token_hash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

      jest.spyOn(User, 'createQueryBuilder').mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(user),
      } as any);

      jest.spyOn(Business, 'findOne').mockResolvedValue(null);

      const dto: RefreshTokenDto = { refresh_token: rawRefreshToken };
      const response = await authService.RefreshToken(dto);

      expect(response.access_token).toBeDefined();
      expect(response.refresh_token).toBeDefined();
      expect(response.refresh_token).not.toBe(rawRefreshToken); // Must be a rotated token!

      // New hash stored at rest
      const newHash = crypto.createHash('sha256').update(response.refresh_token!).digest('hex');
      expect(user.refresh_token_hash).toBe(newHash);
    });

    it('should detect refresh token reuse attack, revoke ALL sessions immediately, and reject with 401', async () => {
      const user = {
        ...mockUser,
        token_version: 1,
        refresh_token_hash: 'hash_of_new_active_token',
        save: jest.fn().mockResolvedValue(true),
      };

      // Attacker or replayer presents an OLD refresh token whose signature is valid, but hash is stale
      const staleRefreshToken = jwtService.sign(
        { sub: user.id, token_version: 1, jti: 'jti-old-compromised', type: 'refresh' },
        { secret: 'test_super_secure_refresh_secret_phase9e', expiresIn: '7d' },
      );

      jest.spyOn(User, 'createQueryBuilder').mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(user),
      } as any);

      const dto: RefreshTokenDto = { refresh_token: staleRefreshToken };

      await expect(authService.RefreshToken(dto)).rejects.toThrow(
        'Refresh token reuse detected. All sessions have been revoked for security.',
      );

      // Invariant: token_version must be incremented and refresh_token_hash cleared
      expect(user.token_version).toBe(2);
      expect(user.refresh_token_hash).toBeNull();
      expect(user.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'audit.record',
        expect.objectContaining({ action: 'REFRESH_TOKEN_REUSE_DETECTED' }),
      );
    });
  });

  describe('5. Session Revocation & JwtStrategy Validation', () => {
    it('should reject access tokens with stale token_version after logout or reset', async () => {
      // User has token_version = 2 in database after password reset / logout
      jest.spyOn(User, 'findOne').mockResolvedValue({
        ...mockUser,
        token_version: 2,
      } as any);

      // Client presents token with old token_version = 1
      const stalePayload = {
        sub: mockUser.id,
        email: mockUser.email,
        token_version: 1,
      };

      await expect(jwtStrategy.validate(stalePayload)).rejects.toThrow('Token has been revoked');
    });

    it('should accept valid access token with current token_version', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue({
        ...mockUser,
        token_version: 2,
      } as any);

      jest.spyOn(Business, 'findOne').mockResolvedValue(null);

      const currentPayload = {
        sub: mockUser.id,
        email: mockUser.email,
        token_version: 2,
      };

      const result = await jwtStrategy.validate(currentPayload);
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
    });

    it('should reject tokens for deleted or inactive users (status !== 1)', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);

      const payload = {
        sub: mockUser.id,
        email: mockUser.email,
        token_version: 1,
      };

      await expect(jwtStrategy.validate(payload)).rejects.toThrow('User account inactive or not found');
    });

    it('should invalidate sessions and refresh token on logout', async () => {
      const activeUser = {
        ...mockUser,
        token_version: 1,
        refresh_token_hash: 'active_hash_123',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockResolvedValue(activeUser as any);

      const res = await authService.Logout(activeUser.id);
      expect(res.status).toBe('SUCCESS');
      expect(activeUser.token_version).toBe(2);
      expect(activeUser.refresh_token_hash).toBeNull();
      expect(activeUser.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'audit.record',
        expect.objectContaining({ action: 'USER_LOGOUT' }),
      );
    });
  });

  describe('6. Login Rate Limiting & Brute Force Abuse Protection', () => {
    it('should enforce account brute-force limits after repeated failures', async () => {
      const clientIp = '198.51.100.42';
      const targetEmail = 'target@victim-org.com';

      // 5 attempts are allowed within 15 mins
      for (let i = 1; i <= 5; i++) {
        const res = await rateLimitService.CheckAuthLogin(clientIp, targetEmail);
        expect(res.allowed).toBe(true);
      }

      // 6th attempt must be blocked with HTTP 429 semantics
      const blockedRes = await rateLimitService.CheckAuthLogin(clientIp, targetEmail);
      expect(blockedRes.allowed).toBe(false);
      expect(blockedRes.remaining).toBe(0);
      expect(blockedRes.retryAfter).toBeGreaterThan(0);
    });

    it('should enforce rate limits on forgot-password requests', async () => {
      const clientIp = '203.0.113.88';

      // 5 forgot password requests allowed
      for (let i = 1; i <= 5; i++) {
        const res = await rateLimitService.CheckAuthForgotPassword(clientIp);
        expect(res.allowed).toBe(true);
      }

      // 6th attempt blocked
      const blocked = await rateLimitService.CheckAuthForgotPassword(clientIp);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfter).toBeGreaterThan(0);
    });
  });
});
