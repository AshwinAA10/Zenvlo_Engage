import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';

export type WidgetType = 'WALL' | 'CAROUSEL' | 'BADGE';
export type WidgetTheme = 'LIGHT' | 'DARK' | 'AUTO';

@Entity('widgets')
@Index(['business_id', 'is_active'])
@Index(['business_id', 'created_on'])
@Index(['embed_token'])
export class Widget extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 30, default: 'WALL' })
  type: WidgetType;

  @Column({ type: 'varchar', length: 30, default: 'DARK' })
  theme: WidgetTheme;

  @Column({ type: 'varchar', length: 50, default: '#10B981' })
  primary_color: string;

  @Column({ type: 'integer', default: 12 })
  max_items: number;

  @Column({ type: 'smallint', default: 4 })
  min_rating: number;

  @Column({ type: 'boolean', default: true })
  show_google_reviews: boolean;

  @Column({ type: 'boolean', default: true })
  show_photos: boolean;

  @Column({ type: 'boolean', default: true })
  show_date: boolean;

  @Column({ type: 'text', nullable: true })
  custom_css: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'varchar', length: 64, unique: true })
  embed_token: string;

  @Column({ type: 'integer', default: 0 })
  views_count: number;
}
