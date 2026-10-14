import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase6WebhookProcessing1791200000000 implements MigrationInterface {
  name = 'Phase6WebhookProcessing1791200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "inbound_webhook_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "business_id" uuid,
        "provider" character varying(50) NOT NULL,
        "event_id" character varying(255) NOT NULL,
        "event_type" character varying(100) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" character varying(30) NOT NULL DEFAULT 'RECEIVED',
        "attempts" smallint NOT NULL DEFAULT 0,
        "last_error" text,
        "job_id" character varying(100),
        "processed_at" TIMESTAMP WITH TIME ZONE,
        "metadata" jsonb,
        "created_on" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_on" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inbound_webhook_events" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_inbound_webhook_events_provider_event_id" ON "inbound_webhook_events" ("provider", "event_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_inbound_webhook_events_business_status" ON "inbound_webhook_events" ("business_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_inbound_webhook_events_created_on" ON "inbound_webhook_events" ("created_on")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_inbound_webhook_events_created_on"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_inbound_webhook_events_business_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_inbound_webhook_events_provider_event_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "inbound_webhook_events"`);
  }
}
