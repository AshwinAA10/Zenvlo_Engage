import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { User } from '../../User/entities/user.entity';
import { WorkspaceMember } from '../../Tenant/entities/workspace-member.entity';
import { LoginDto, AuthResponseDto } from '../models/auth.dto';
import { EVENT_AUDIT_RECORD } from '../../../common/constants';
import { AuditRecordEvent } from '../../../events/audit.event';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async ValidateUser(email: string, pass: string): Promise<User> {
    const user = await User.createQueryBuilder('user')
      .addSelect('user.password_hash')
      .where('user.email = :email', { email })
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

  async Login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.ValidateUser(dto.email, dto.password);

    const members = await WorkspaceMember.find({
      where: { user_id: user.id, status: 1 },
    });
    const workspaceIds = members.map((m) => m.workspace_id);

    const payload = {
      sub: user.id,
      email: user.email,
      workspaces: workspaceIds,
    };

    const token = this.jwtService.sign(payload);

    if (workspaceIds.length > 0) {
      this.eventEmitter.emit(
        EVENT_AUDIT_RECORD,
        new AuditRecordEvent(
          workspaceIds[0],
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
    };
  }
}
