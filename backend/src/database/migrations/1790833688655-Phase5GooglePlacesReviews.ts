import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase5GooglePlacesReviews1790833688655
  implements MigrationInterface
{
  name = 'Phase5GooglePlacesReviews1790833688655';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "review_sources" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "status" smallint NOT NULL DEFAULT '1',
        "created_by_id" uuid NOT NULL,
        "created_on" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_by_id" uuid NOT NULL,
        "updated_on" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_on" TIMESTAMP WITH TIME ZONE,
        "platform" character varying(50) NOT NULL DEFAULT 'GOOGLE',
        "external_id" character varying(255) NOT NULL,
        "name" character varying(255) NOT NULL,
        "address" character varying(500),
        "rating" numeric(3, 2) NOT NULL DEFAULT 0,
        "review_count" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_synced_at" TIMESTAMP WITH TIME ZONE,
        "metadata" jsonb,
        CONSTRAINT "PK_review_sources" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_review_sources_business_id" ON "review_sources" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_review_sources_business_platform" ON "review_sources" ("business_id", "platform")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_review_sources_business_external_id" ON "review_sources" ("business_id", "external_id")`,
    );

    await queryRunner.query(
      `CREATE TABLE "reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "status" smallint NOT NULL DEFAULT '1',
        "created_by_id" uuid NOT NULL,
        "created_on" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_by_id" uuid NOT NULL,
        "updated_on" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_on" TIMESTAMP WITH TIME ZONE,
        "source_id" uuid NOT NULL,
        "external_id" character varying(255) NOT NULL,
        "author_name" character varying(255) NOT NULL,
        "author_photo_url" character varying(500),
        "rating" smallint NOT NULL,
        "content" text NOT NULL,
        "review_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "original_url" character varying(500),
        "is_visible" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        CONSTRAINT "PK_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reviews_source" FOREIGN KEY ("source_id") REFERENCES "review_sources"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_reviews_business_id" ON "reviews" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reviews_business_source_id" ON "reviews" ("business_id", "source_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reviews_business_external_id" ON "reviews" ("business_id", "external_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reviews_business_rating" ON "reviews" ("business_id", "rating")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reviews_business_is_visible" ON "reviews" ("business_id", "is_visible")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reviews_business_review_date" ON "reviews" ("business_id", "review_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_reviews_business_review_date"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_reviews_business_is_visible"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_reviews_business_rating"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_reviews_business_external_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_reviews_business_source_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_reviews_business_id"`);
    await queryRunner.query(`DROP TABLE "reviews"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_review_sources_business_external_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_review_sources_business_platform"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_review_sources_business_id"`);
    await queryRunner.query(`DROP TABLE "review_sources"`);
  }
}
