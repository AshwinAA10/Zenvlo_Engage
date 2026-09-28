import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { CLS_WORKSPACE_ID, CLS_USER_ID } from '../common/constants';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly cls: ClsService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('Unauthenticated request cannot access tenant data');
    }

    const businessId = user.business_id;
    if (!businessId) {
      throw new ForbiddenException(
        'User has not completed business onboarding. Complete onboarding to access this resource.',
      );
    }

    if (this.cls.isActive()) {
      this.cls.set('business_id', businessId);
      this.cls.set(CLS_WORKSPACE_ID, businessId);
      this.cls.set('workspace_id', businessId);
      this.cls.set(CLS_USER_ID, user.id);
      this.cls.set('user_id', user.id);
    }

    return true;
  }
}
