import {
  BaseEntity,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity('users')
export class User extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password_hash: string;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  password_reset_token_hash: string | null;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  password_reset_expires_at: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  refresh_token_hash: string | null;

  @Column({ type: 'int', default: 1 })
  token_version: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  first_name: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  last_name: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar_url: string | null;

  @Column({ type: 'smallint', default: 1 })
  status: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_on: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_on: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_on: Date | null;
}
