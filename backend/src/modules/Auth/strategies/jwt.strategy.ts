import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../../User/entities/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  workspaces?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'zenvlo_engage_dev_secret_key_change_in_production',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await User.findOne({ where: { id: payload.sub, status: 1 } });
    if (!user) {
      throw new UnauthorizedException('User account inactive or not found');
    }

    return {
      id: user.id,
      email: user.email,
      workspaces: payload.workspaces || [],
    };
  }
}
