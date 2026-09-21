import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';

@Entity('workflow_executions')
export class WorkflowExecution extends TenantBaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  workflow_id: string;

  @Column({ type: 'varchar', length: 100 })
  trigger_event: string;

  @Column({ type: 'varchar', length: 50, default: 'running' })
  execution_status: string;

  @Column({ type: 'jsonb', nullable: true })
  execution_log: Record<string, any> | null;
}
