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
