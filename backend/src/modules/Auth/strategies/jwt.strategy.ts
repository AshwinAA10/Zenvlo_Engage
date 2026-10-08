import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { User } from '../../User/entities/user.entity';
import { Business } from '../../Business/entities/business.entity';
import { CLS_USER_ID, CLS_WORKSPACE_ID } from '../../../common/constants';

export interface JwtPayload {
  sub: string;
  email: string;
  business_id?: string | null;
  workspaces?: string[];
  token_version?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly cls: ClsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'super_secret_jwt_key_zenvlo_engage_production_change_me',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await User.findOne({ where: { id: payload.sub, status: 1 } });
    if (!user) {
      throw new UnauthorizedException('User account inactive or not found');
    }

    if (
      payload.token_version !== undefined &&
      user.token_version !== undefined &&
      user.token_version !== payload.token_version
    ) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const business = await Business.findOne({
      where: { user_id: user.id, status: 1 },
      order: { created_on: 'ASC' },
    });

    const businessId = business ? business.id : (payload.business_id || null);

    // Populate CLS strictly from validated server session
    if (this.cls.isActive()) {
      this.cls.set(CLS_USER_ID, user.id);
      this.cls.set('user_id', user.id);
      if (businessId) {
        this.cls.set('business_id', businessId);
        this.cls.set(CLS_WORKSPACE_ID, businessId);
        this.cls.set('workspace_id', businessId);
      }
    }

    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      business_id: businessId,
      business: business || null,
    };
  }
}
