import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { User } from '../../User/entities/user.entity';
import { Business } from '../../Business/entities/business.entity';
import { BusinessService } from '../../Business/services/business.service';
import { LoginDto, SignupDto, AuthResponseDto } from '../models/auth.dto';
import { EVENT_AUDIT_RECORD } from '../../../common/constants';
import { AuditRecordEvent } from '../../../events/audit.event';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
    private readonly businessService: BusinessService,
  ) {}

  async ValidateUser(email: string, pass: string): Promise<User> {
    const user = await User.createQueryBuilder('user')
      .addSelect('user.password_hash')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .andWhere('user.status = 1')
      .getOne();

    if (!user) {
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

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(dto.password, saltRounds);

    const user = new User();
    user.email = normalizedEmail;
    user.password_hash = password_hash;
    user.first_name = dto.first_name?.trim() || null;
    user.last_name = dto.last_name?.trim() || null;
    await user.save();

    let business: Business | null = null;
    if (dto.business_name && dto.business_name.trim().length > 0) {
      business = await this.businessService.InsertOnboarding(user.id, {
        name: dto.business_name.trim(),
      });
    }

    const payload = {
      sub: user.id,
      email: user.email,
      business_id: business ? business.id : null,
    };

    const token = this.jwtService.sign(payload);

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
      access_token: token,
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

    const payload = {
      sub: user.id,
      email: user.email,
      business_id: business ? business.id : null,
    };

    const token = this.jwtService.sign(payload);

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
      access_token: token,
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

  async Logout() {
    return { status: 'SUCCESS', message: 'Logged out successfully' };
  }
}
