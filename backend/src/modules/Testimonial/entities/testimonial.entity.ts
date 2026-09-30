import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

@Entity('testimonials')
@Index(['business_id', 'approval_status'])
@Index(['business_id', 'created_on'])
export class Testimonial extends TenantBaseEntity {
  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @Column({ type: 'varchar', length: 255 })
  customer_name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  customer_phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customer_email: string | null;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  photo_url: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  video_url: string | null;

  @Column({ type: 'boolean', default: true })
  consent_given: boolean;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  consent_timestamp: Date;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  approval_status: ApprovalStatus;

  @Column({ type: 'varchar', length: 50, default: 'PUBLIC_FORM' })
  source: string;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by_id: string | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;
}
