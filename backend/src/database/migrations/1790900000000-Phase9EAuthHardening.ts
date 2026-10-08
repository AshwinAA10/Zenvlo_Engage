import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Phase9EAuthHardening1790900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('users', [
      new TableColumn({
        name: 'password_reset_token_hash',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'password_reset_expires_at',
        type: 'timestamptz',
        isNullable: true,
      }),
      new TableColumn({
        name: 'refresh_token_hash',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'token_version',
        type: 'integer',
        default: 1,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'token_version');
    await queryRunner.dropColumn('users', 'refresh_token_hash');
    await queryRunner.dropColumn('users', 'password_reset_expires_at');
    await queryRunner.dropColumn('users', 'password_reset_token_hash');
  }
}
