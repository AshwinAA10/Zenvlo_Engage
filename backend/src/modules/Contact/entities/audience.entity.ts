import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';

@Entity('audiences')
export class Audience extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int', default: 0 })
  contact_count: number;
}
