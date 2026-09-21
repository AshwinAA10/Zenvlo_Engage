# Zenvlo Engage — Database Architecture

## Technology Stack
- **Primary Engine**: PostgreSQL 16
- **Time-Series / Audit Engine**: TimescaleDB extension
- **ORM**: TypeORM Active Record (`BaseEntity`)
- **Migration Engine**: TypeORM CLI

---

## Entity Hierarchy
The project strictly implements a single inheritance hierarchy for all tenant data models:

```text
TypeORM BaseEntity
       ↓
   BaseTable
       ↓
TenantBaseEntity
       ↓
Domain Entities
```

### 1. BaseTable
Provides global primary key and audit metadata:
- `id`: `UUID` (Primary generated column)
- `workspace_id`: `UUID` NOT NULL (indexed)
- `status`: `smallint` DEFAULT 1 (1 = active, 0 = disabled)
- `created_by_id`: `UUID` NOT NULL
- `created_on`: `timestamptz` (`@CreateDateColumn`)
- `updated_by_id`: `UUID` NOT NULL
- `updated_on`: `timestamptz` (`@UpdateDateColumn`)
- `deleted_on`: `timestamptz` NULL (`@DeleteDateColumn`, soft-delete)

### 2. TenantBaseEntity
Extends `BaseTable`. Implements TypeORM entity lifecycle hooks:
- `@BeforeInsert()`: Automatically populates `workspace_id`, `created_by_id`, and `updated_by_id` from the active `nestjs-cls` context.
- `@BeforeUpdate()`: Automatically populates `updated_by_id` from `nestjs-cls`.

---

## Migration Policy
- `synchronize: false` is strictly enforced for production integrity.
- Migrations are generated via TypeORM CLI:
  ```bash
  npm --prefix backend run typeorm:generate -- src/database/migrations/<MigrationName>
  npm --prefix backend run typeorm:run
  ```
- Every migration must be manually inspected prior to execution.

---

## Audit Trail (TimescaleDB)
- Table: `audit_logs`
- Partitioned as a TimescaleDB hypertable on `created_on`.
- Decoupled from application services: emitted as `audit.record` via `EventEmitter2` and persisted by the `AuditListener`.
