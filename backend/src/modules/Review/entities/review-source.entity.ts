import { Entity, Column, Index, OneToMany } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';
import { Review } from './review.entity';

@Entity('review_sources')
@Index(['business_id', 'platform'])
@Index(['business_id', 'external_id'])
export class ReviewSource extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 50, default: 'GOOGLE' })
  platform: string;

  @Column({ type: 'varchar', length: 255 })
  external_id: string; // Google Place ID

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string | null;

  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ type: 'integer', default: 0 })
  review_count: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  last_synced_at: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @OneToMany(() => Review, (review) => review.source)
  reviews: Review[];
}
