import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';

@Entity('segments')
export class Segment extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'jsonb' })
  filter_criteria: Record<string, any>;
}
