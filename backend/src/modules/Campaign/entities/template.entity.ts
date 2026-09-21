import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';

@Entity('templates')
export class Template extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, default: 'utility' })
  category: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  variables: string[];
}
