import { Entity, Column, Index } from 'typeorm';
import { TenantBaseEntity } from '../../../database/tenant-base.entity';

@Entity('contacts')
export class Contact extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 120, nullable: true })
  first_name: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  last_name: string | null;

  @Index()
  @Column({ type: 'varchar', length: 50, nullable: true })
  phone_number: string | null;

  @Index()
  @Column({ type: 'varchar', length: 120, nullable: true })
  instagram_handle: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  custom_attributes: Record<string, any>;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tags: string[];
}
