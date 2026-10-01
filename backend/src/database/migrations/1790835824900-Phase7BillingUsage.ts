import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class Phase7BillingUsage1790835824900 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create subscriptions table
    await queryRunner.createTable(
      new Table({
        name: 'subscriptions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'business_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'plan',
            type: 'varchar',
            length: '30',
            default: "'FREE'",
          },
          {
            name: 'billing_cycle',
            type: 'varchar',
            length: '30',
            default: "'MONTHLY'",
          },
          {
            name: 'status',
            type: 'varchar',
            length: '30',
            default: "'ACTIVE'",
          },
          {
            name: 'razorpay_customer_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'razorpay_subscription_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'razorpay_order_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'razorpay_payment_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'current_period_start',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'current_period_end',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'cancel_at_period_end',
            type: 'boolean',
            default: false,
          },
          {
            name: 'canceled_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'created_on',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_on',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'subscriptions',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedTableName: 'businesses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'subscriptions',
      new TableIndex({
        name: 'IDX_subscriptions_business_id',
        columnNames: ['business_id'],
      }),
    );

    // 2. Create usages table
    await queryRunner.createTable(
      new Table({
        name: 'usages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'business_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'period_month',
            type: 'varchar',
            length: '7', // 'YYYY-MM'
            isNullable: false,
          },
          {
            name: 'whatsapp_requests_sent',
            type: 'integer',
            default: 0,
          },
          {
            name: 'whatsapp_requests_limit',
            type: 'integer',
            default: 50,
          },
          {
            name: 'created_on',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_on',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'usages',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedTableName: 'businesses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'usages',
      new TableIndex({
        name: 'IDX_usages_business_month_unique',
        columnNames: ['business_id', 'period_month'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('usages', true);
    await queryRunner.dropTable('subscriptions', true);
  }
}
