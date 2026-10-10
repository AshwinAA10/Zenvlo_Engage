import {
  BaseEntity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Entity,
} from 'typeorm';

@Entity('usages')
@Index(['business_id', 'period_month'], { unique: true })
export class Usage extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'varchar', length: 7 })
  period_month: string; // 'YYYY-MM'

  @Column({ type: 'integer', default: 0 })
  whatsapp_requests_sent: number;

  @Column({ type: 'integer', default: 50 })
  whatsapp_requests_limit: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_on: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_on: Date;
}

