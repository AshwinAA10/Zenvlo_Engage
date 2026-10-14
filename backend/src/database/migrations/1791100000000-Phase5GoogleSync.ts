import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase5GoogleSync1791100000000 implements MigrationInterface {
  name = 'Phase5GoogleSync1791100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "review_sources" ADD COLUMN IF NOT EXISTS "sync_status" character varying(50) NOT NULL DEFAULT 'IDLE'`,
    );
    await queryRunner.query(
      `ALTER TABLE "review_sources" ADD COLUMN IF NOT EXISTS "last_sync_error" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "review_sources" ADD COLUMN IF NOT EXISTS "sync_job_id" character varying(100)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_review_sources_business_sync_status" ON "review_sources" ("business_id", "sync_status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_review_sources_business_sync_status"`);
    await queryRunner.query(`ALTER TABLE "review_sources" DROP COLUMN IF EXISTS "sync_job_id"`);
    await queryRunner.query(`ALTER TABLE "review_sources" DROP COLUMN IF EXISTS "last_sync_error"`);
    await queryRunner.query(`ALTER TABLE "review_sources" DROP COLUMN IF EXISTS "sync_status"`);
  }
}
