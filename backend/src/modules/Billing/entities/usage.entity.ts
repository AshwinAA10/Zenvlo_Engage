import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';

@Entity('usages')
@Index(['business_id', 'period_month'], { unique: true })
export class Usage extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 7 })
  period_month: string; // 'YYYY-MM'

  @Column({ type: 'integer', default: 0 })
  whatsapp_requests_sent: number;

  @Column({ type: 'integer', default: 50 })
  whatsapp_requests_limit: number;
}
