import { Entity, Column, Index } from 'typeorm';
import { BaseTable } from '../../../database/base.table';

@Entity('workspaces')
export class Workspace extends BaseTable {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120 })
  slug: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, any> | null;
}
