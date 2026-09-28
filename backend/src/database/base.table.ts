import {
  BaseEntity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export abstract class BaseTable extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'business_id', type: 'uuid' })
  business_id: string;

  // Backward compatibility alias for workspace_id
  get workspace_id(): string {
    return this.business_id;
  }
  set workspace_id(val: string) {
    this.business_id = val;
  }

  @Column({ type: 'smallint', default: 1 })
  status: number;

  @Column({ type: 'uuid' })
  created_by_id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_on: Date;

  @Column({ type: 'uuid' })
  updated_by_id: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_on: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_on: Date | null;
}
