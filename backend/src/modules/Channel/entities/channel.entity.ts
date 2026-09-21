import { Entity, Column } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';

@Entity('channels')
export class Channel extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  channel_identifier: string;

  @Column({ type: 'jsonb', nullable: true, select: false })
  credentials: Record<string, any> | null;

  @Column({ type: 'boolean', default: false })
  is_connected: boolean;
}
