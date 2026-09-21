import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { HEADER_WORKSPACE_ID, CLS_WORKSPACE_ID, CLS_USER_ID } from '../common/constants';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly cls: ClsService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const workspaceId = request.headers[HEADER_WORKSPACE_ID] as string;

    if (!workspaceId) {
      throw new BadRequestException(
        `Missing required multi-tenant header: '${HEADER_WORKSPACE_ID}'`,
      );
    }

    if (user && user.workspaces && Array.isArray(user.workspaces)) {
      const hasAccess = user.workspaces.some(
        (wsId: string) => wsId === workspaceId,
      );
      if (!hasAccess) {
        throw new ForbiddenException(
          `User does not have authorization for workspace '${workspaceId}'`,
        );
      }
    }

    this.cls.set(CLS_WORKSPACE_ID, workspaceId);
    if (user && user.id) {
      this.cls.set(CLS_USER_ID, user.id);
    }

    return true;
  }
}
