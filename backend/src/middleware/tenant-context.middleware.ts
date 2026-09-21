import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';
import { HEADER_WORKSPACE_ID, CLS_WORKSPACE_ID } from '../common/constants';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const workspaceId = req.headers[HEADER_WORKSPACE_ID] as string;
    if (workspaceId) {
      this.cls.set(CLS_WORKSPACE_ID, workspaceId);
    }
    next();
  }
}
