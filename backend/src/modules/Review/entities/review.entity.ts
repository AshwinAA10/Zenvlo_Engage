import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';
import { ReviewSource } from './review-source.entity';

@Entity('reviews')
@Index(['business_id', 'source_id'])
@Index(['business_id', 'external_id'])
@Index(['business_id', 'rating'])
@Index(['business_id', 'is_visible'])
@Index(['business_id', 'review_date'])
export class Review extends TenantBaseEntity {
  @Column({ type: 'uuid' })
  source_id: string;

  @Column({ type: 'varchar', length: 255 })
  external_id: string; // Google review ID or signature

  @Column({ type: 'varchar', length: 255 })
  author_name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  author_photo_url: string | null;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'timestamptz' })
  review_date: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  original_url: string | null;

  @Column({ type: 'boolean', default: true })
  is_visible: boolean; // Toggled by business owner for widget display

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @ManyToOne(() => ReviewSource, (source) => source.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_id' })
  source: ReviewSource;
}
