import { Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { WorkflowDefinition } from '../entities/workflow-definition.entity';
import { CreateWorkflowDto, UpdateWorkflowDto } from '../models/workflow.dto';
import { CLS_WORKSPACE_ID } from '../../../common/constants';

@Injectable()
export class WorkflowService {
  constructor(private readonly cls: ClsService) {}

  async GetAll(): Promise<WorkflowDefinition[]> {
    const workspaceId = this.cls.get<string>(CLS_WORKSPACE_ID);
    return WorkflowDefinition.find({
      where: { workspace_id: workspaceId, status: 1 },
      order: { created_on: 'DESC' },
    });
  }

  async GetById(id: string): Promise<WorkflowDefinition> {
    const workspaceId = this.cls.get<string>(CLS_WORKSPACE_ID);
    const workflow = await WorkflowDefinition.findOne({
      where: { id, workspace_id: workspaceId, status: 1 },
    });
    if (!workflow) {
      throw new NotFoundException(`Workflow with ID '${id}' not found`);
    }
    return workflow;
  }

  async Insert(dto: CreateWorkflowDto): Promise<WorkflowDefinition> {
    const workflow = new WorkflowDefinition();
    workflow.name = dto.name;
    workflow.description = dto.description || null;
    workflow.is_active = dto.is_active !== undefined ? dto.is_active : true;
    workflow.definition = dto.definition || { nodes: [], edges: [] };

    return workflow.save();
  }

  async Update(id: string, dto: UpdateWorkflowDto): Promise<WorkflowDefinition> {
    const workflow = await this.GetById(id);

    if (dto.name !== undefined) workflow.name = dto.name;
    if (dto.description !== undefined) workflow.description = dto.description;
    if (dto.is_active !== undefined) workflow.is_active = dto.is_active;
    if (dto.definition !== undefined) workflow.definition = dto.definition;

    return workflow.save();
  }

  async Delete(id: string): Promise<void> {
    const workflow = await this.GetById(id);
    await workflow.softRemove();
  }
}
