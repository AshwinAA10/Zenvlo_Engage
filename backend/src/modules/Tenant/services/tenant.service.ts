import { Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Workspace } from '../entities/workspace.entity';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from '../models/tenant.dto';
import { CLS_USER_ID } from '../../../common/constants';

@Injectable()
export class TenantService {
  constructor(private readonly cls: ClsService) {}

  async GetAll(): Promise<Workspace[]> {
    return Workspace.find({
      where: { status: 1 },
      order: { created_on: 'DESC' },
    });
  }

  async GetById(id: string): Promise<Workspace> {
    const workspace = await Workspace.findOne({
      where: { id, status: 1 },
    });
    if (!workspace) {
      throw new NotFoundException(`Workspace with ID '${id}' not found`);
    }
    return workspace;
  }

  async Insert(dto: CreateWorkspaceDto): Promise<Workspace> {
    const userId = this.cls.get<string>(CLS_USER_ID) || '00000000-0000-0000-0000-000000000000';

    const workspace = new Workspace();
    workspace.name = dto.name;
    workspace.slug = dto.slug;
    workspace.organization_id = dto.organization_id;
    workspace.settings = dto.settings || null;
    workspace.created_by_id = userId;
    workspace.updated_by_id = userId;

    const saved = await workspace.save();
    if (!saved.workspace_id) {
      saved.workspace_id = saved.id;
      await saved.save();
    }
    return saved;
  }

  async Update(id: string, dto: UpdateWorkspaceDto): Promise<Workspace> {
    const workspace = await this.GetById(id);
    const userId = this.cls.get<string>(CLS_USER_ID);

    if (dto.name !== undefined) workspace.name = dto.name;
    if (dto.settings !== undefined) workspace.settings = dto.settings;
    if (userId) workspace.updated_by_id = userId;

    return workspace.save();
  }

  async Delete(id: string): Promise<void> {
    const workspace = await this.GetById(id);
    await workspace.softRemove();
  }
}
