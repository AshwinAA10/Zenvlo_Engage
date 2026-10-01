import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase6Widgets1790834574363 implements MigrationInterface {
  name = 'Phase6Widgets1790834574363';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "widgets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "status" smallint NOT NULL DEFAULT '1',
        "created_by_id" uuid NOT NULL,
        "created_on" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_by_id" uuid NOT NULL,
        "updated_on" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_on" TIMESTAMP WITH TIME ZONE,
        "name" character varying(255) NOT NULL,
        "type" character varying(30) NOT NULL DEFAULT 'WALL',
        "theme" character varying(30) NOT NULL DEFAULT 'DARK',
        "primary_color" character varying(50) NOT NULL DEFAULT '#10B981',
        "max_items" integer NOT NULL DEFAULT 12,
        "min_rating" smallint NOT NULL DEFAULT 4,
        "show_google_reviews" boolean NOT NULL DEFAULT true,
        "show_photos" boolean NOT NULL DEFAULT true,
        "show_date" boolean NOT NULL DEFAULT true,
        "custom_css" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "embed_token" character varying(64) NOT NULL,
        "views_count" integer NOT NULL DEFAULT 0,
        CONSTRAINT "UQ_widgets_embed_token" UNIQUE ("embed_token"),
        CONSTRAINT "PK_widgets" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_widgets_business_id" ON "widgets" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_widgets_business_is_active" ON "widgets" ("business_id", "is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_widgets_business_created_on" ON "widgets" ("business_id", "created_on")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_widgets_embed_token" ON "widgets" ("embed_token")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_widgets_embed_token"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_widgets_business_created_on"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_widgets_business_is_active"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_widgets_business_id"`);
    await queryRunner.query(`DROP TABLE "widgets"`);
  }
}
