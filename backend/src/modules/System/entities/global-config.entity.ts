import { BaseEntity, Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('global_configs')
export class GlobalConfig extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  key: string;

  @Column({ type: 'jsonb' })
  value: any;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_on: Date;
}
