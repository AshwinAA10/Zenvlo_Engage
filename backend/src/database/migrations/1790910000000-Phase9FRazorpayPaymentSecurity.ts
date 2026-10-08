import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class Phase9FRazorpayPaymentSecurity1790910000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create payments table
    await queryRunner.createTable(
      new Table({
        name: 'payments',
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
            name: 'razorpay_order_id',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'razorpay_payment_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'amount',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '10',
            default: "'INR'",
          },
          {
            name: 'payment_status',
            type: 'varchar',
            length: '30',
            default: "'CREATED'",
          },
          {
            name: 'plan',
            type: 'varchar',
            length: '30',
            isNullable: false,
          },
          {
            name: 'billing_cycle',
            type: 'varchar',
            length: '30',
            default: "'MONTHLY'",
          },
          {
            name: 'receipt',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'method',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'error_code',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'error_description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'refund_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'refund_amount',
            type: 'integer',
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
      'payments',
      new TableForeignKey({
        columnNames: ['business_id'],
        referencedTableName: 'businesses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_payments_business_id',
        columnNames: ['business_id'],
      }),
    );

    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_payments_razorpay_order_id',
        columnNames: ['razorpay_order_id'],
      }),
    );

    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_payments_razorpay_payment_id_unique',
        columnNames: ['razorpay_payment_id'],
        isUnique: true,
      }),
    );

    // 2. Create payment_webhook_events table
    await queryRunner.createTable(
      new Table({
        name: 'payment_webhook_events',
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
            isNullable: true,
          },
          {
            name: 'event_id',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'event_type',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'entity_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'payload',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '30',
            default: "'PROCESSED'",
          },
          {
            name: 'processed_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
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

    await queryRunner.createIndex(
      'payment_webhook_events',
      new TableIndex({
        name: 'IDX_payment_webhook_events_event_id_unique',
        columnNames: ['event_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('payment_webhook_events', true);
    await queryRunner.dropTable('payments', true);
  }
}
