import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase4BatchProcessing1791000000000 implements MigrationInterface {
  name = 'Phase4BatchProcessing1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "batch_executions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "status" smallint NOT NULL DEFAULT '1',
        "created_by_id" uuid NOT NULL,
        "created_on" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_by_id" uuid NOT NULL,
        "updated_on" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_on" TIMESTAMP WITH TIME ZONE,
        "operation_type" character varying(80) NOT NULL,
        "delivery_status" character varying(30) NOT NULL DEFAULT 'PENDING',
        "total_items" integer NOT NULL DEFAULT 0,
        "processed_items" integer NOT NULL DEFAULT 0,
        "succeeded_items" integer NOT NULL DEFAULT 0,
        "failed_items" integer NOT NULL DEFAULT 0,
        "skipped_items" integer NOT NULL DEFAULT 0,
        "chunk_size" integer NOT NULL DEFAULT 50,
        "total_chunks" integer NOT NULL DEFAULT 0,
        "processed_chunks" integer NOT NULL DEFAULT 0,
        "started_at" TIMESTAMP WITH TIME ZONE,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "metadata" jsonb,
        "error_summary" text,
        CONSTRAINT "PK_batch_executions" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_batch_executions_business_id" ON "batch_executions" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_batch_executions_business_delivery_status" ON "batch_executions" ("business_id", "delivery_status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_batch_executions_business_created_on" ON "batch_executions" ("business_id", "created_on")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_batch_executions_business_created_on"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_batch_executions_business_delivery_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_batch_executions_business_id"`);
    await queryRunner.query(`DROP TABLE "batch_executions"`);
  }
}
