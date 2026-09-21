---
name: database-development
description: TypeORM Active Record entity hierarchy, BaseTable, TenantBaseEntity, migrations, TimescaleDB audit logs, and indexing rules for Zenvlo Engage.
---

# Zenvlo Engage — Database Development Skill

## 1. Entity Hierarchy
Every database table must inherit from the approved hierarchy:

```text
TypeORM BaseEntity
       ↓
   BaseTable
       ↓
TenantBaseEntity
       ↓
 Domain Entities (e.g. Contact, Campaign, Conversation)
```

### BaseTable Definition
`BaseTable` defines common schema fields across all tables:
- `id`: UUID (Primary Key, auto-generated)
- `workspace_id`: UUID NOT NULL, indexed
- `status`: integer, default `1` (1 = Active, 0 = Inactive, etc.)
- `created_by_id`: UUID NOT NULL
- `created_on`: timestamp with time zone (`@CreateDateColumn`)
- `updated_by_id`: UUID NOT NULL
- `updated_on`: timestamp with time zone (`@UpdateDateColumn`)
- `deleted_on`: timestamp with time zone, nullable (`@DeleteDateColumn` for soft delete)

### TenantBaseEntity Definition
`TenantBaseEntity` extends `BaseTable` and hooks into `@BeforeInsert()` and `@BeforeUpdate()` to automatically pull:
- `workspace_id`
- `created_by_id`
- `updated_by_id`
from the active `nestjs-cls` request context if not explicitly set.

---

## 2. Active Record Mandate
Never create Repository classes or inject `Repository<T>`.
Execute queries directly on entities:
```typescript
// Querying
const active = await Campaign.find({
  where: { workspace_id: wsId, status: 1 },
  order: { created_on: 'DESC' },
});

// Inserting
const campaign = new Campaign();
campaign.name = 'Spring Launch';
await campaign.save();

// Soft Deletion
await campaign.softRemove();
```

---

## 3. Database Migrations
- `synchronize: true` is strictly prohibited in production and staging environments.
- All schema alterations must be applied via TypeORM migrations:
  - Generate: `npm run typeorm -- migration:generate src/database/migrations/<MigrationName> -d src/database/data-source.ts`
  - Run: `npm run typeorm -- migration:run -d src/database/data-source.ts`
  - Revert: `npm run typeorm -- migration:revert -d src/database/data-source.ts`
- Always review generated migration files before execution.

---

## 4. TimescaleDB & Audit Log Design
Audit logs are stored in a dedicated `audit_logs` table designed for TimescaleDB hypertable conversion:
- Fields: `id`, `workspace_id`, `actor_id`, `action`, `entity_name`, `entity_id`, `metadata` (JSONB), `created_on` (timestamp).
- Hypertable partitioning on `created_on` enables high write throughput, efficient time-series querying, and automated data retention policies.

---

## 5. Indexing & Tenant Isolation
- Compound index on `(workspace_id, status)` for fast tenant list queries.
- Index on `(workspace_id, id)` to prevent full-table scans on tenant entity lookups.
- Foreign keys must enforce referential integrity with appropriate `ON DELETE` rules.
