import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase4RequestTracking1790785998274 implements MigrationInterface {
  name = 'Phase4RequestTracking1790785998274';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "request_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "status" smallint NOT NULL DEFAULT '1',
        "created_by_id" uuid NOT NULL,
        "created_on" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_by_id" uuid NOT NULL,
        "updated_on" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_on" TIMESTAMP WITH TIME ZONE,
        "customer_id" uuid,
        "customer_name" character varying(255) NOT NULL,
        "customer_phone" character varying(50) NOT NULL,
        "channel" character varying(30) NOT NULL DEFAULT 'WHATSAPP',
        "template_name" character varying(100) NOT NULL DEFAULT 'testimonial_request',
        "testimonial_url" character varying(500) NOT NULL,
        "custom_message" text,
        "delivery_status" character varying(30) NOT NULL DEFAULT 'PENDING_CONTRACT',
        "message_id" character varying(255),
        "error_message" text,
        "sent_at" TIMESTAMP WITH TIME ZONE,
        "delivered_at" TIMESTAMP WITH TIME ZONE,
        "read_at" TIMESTAMP WITH TIME ZONE,
        "testimonial_id" uuid,
        "response_received_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_request_logs" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_request_logs_business_id" ON "request_logs" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_request_logs_business_delivery_status" ON "request_logs" ("business_id", "delivery_status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_request_logs_business_created_on" ON "request_logs" ("business_id", "created_on")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_request_logs_business_customer_id" ON "request_logs" ("business_id", "customer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_request_logs_message_id" ON "request_logs" ("message_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "customers" ADD COLUMN "last_request_sent_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD COLUMN "request_count" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN "request_count"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN "last_request_sent_at"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_request_logs_message_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_request_logs_business_customer_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_request_logs_business_created_on"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_request_logs_business_delivery_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_request_logs_business_id"`);
    await queryRunner.query(`DROP TABLE "request_logs"`);
  }
}
