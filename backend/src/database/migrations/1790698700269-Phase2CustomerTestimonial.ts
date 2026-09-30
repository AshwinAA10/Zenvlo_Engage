import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase2CustomerTestimonial1790698700269 implements MigrationInterface {
    name = 'Phase2CustomerTestimonial1790698700269'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "testimonials" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "status" smallint NOT NULL DEFAULT '1', "created_by_id" uuid NOT NULL, "created_on" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by_id" uuid NOT NULL, "updated_on" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_on" TIMESTAMP WITH TIME ZONE, "customer_id" uuid, "customer_name" character varying(255) NOT NULL, "customer_phone" character varying(50), "customer_email" character varying(255), "rating" smallint NOT NULL, "content" text NOT NULL, "photo_url" character varying(500), "video_url" character varying(500), "consent_given" boolean NOT NULL DEFAULT true, "consent_timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "approval_status" character varying(20) NOT NULL DEFAULT 'PENDING', "source" character varying(50) NOT NULL DEFAULT 'PUBLIC_FORM', "approved_at" TIMESTAMP WITH TIME ZONE, "approved_by_id" uuid, "rejection_reason" text, CONSTRAINT "PK_63b03c608bd258f115a0a4a1060" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_908360acfd0501a6bdf19cf107" ON "testimonials" ("business_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_13662506f6db1353ede9516073" ON "testimonials" ("business_id", "created_on") `);
        await queryRunner.query(`CREATE INDEX "IDX_6990fe4eb09e8f36dc7bd2d5ee" ON "testimonials" ("business_id", "approval_status") `);
        await queryRunner.query(`CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "status" smallint NOT NULL DEFAULT '1', "created_by_id" uuid NOT NULL, "created_on" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by_id" uuid NOT NULL, "updated_on" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_on" TIMESTAMP WITH TIME ZONE, "name" character varying(255) NOT NULL, "phone" character varying(50) NOT NULL, "email" character varying(255), "notes" text, "tags" jsonb NOT NULL DEFAULT '[]', "metadata" jsonb, CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c04b1ab3076e753f96c6431828" ON "customers" ("business_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_eb5b13026708dad15f31091fb1" ON "customers" ("business_id", "created_on") `);
        await queryRunner.query(`CREATE INDEX "IDX_af93d923de1e8b9e89dfffe8ee" ON "customers" ("business_id", "phone") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_af93d923de1e8b9e89dfffe8ee"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_eb5b13026708dad15f31091fb1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c04b1ab3076e753f96c6431828"`);
        await queryRunner.query(`DROP TABLE "customers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6990fe4eb09e8f36dc7bd2d5ee"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_13662506f6db1353ede9516073"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_908360acfd0501a6bdf19cf107"`);
        await queryRunner.query(`DROP TABLE "testimonials"`);
    }

}
