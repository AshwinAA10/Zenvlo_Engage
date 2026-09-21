---
name: project-architecture
description: Defines the core architecture, technology stack, multi-tenancy, and invariant system principles for Zenvlo Engage.
---

# Zenvlo Engage — Project Architecture Skill

## 1. Architectural Philosophy
Zenvlo Engage is a standalone, multi-tenant SaaS platform for WhatsApp and Instagram automation, forming a core pillar of the broader Zenvlo ecosystem (alongside CRM and Voice).

The architecture strictly adheres to:
- **Correctness & Reliability**: Absolute consistency in data handling, transaction management, and tenant isolation.
- **Tenant Boundary Enforcement**: Zero tolerance for cross-tenant data leakage. Every tenant-scoped entity and query is tied to a verified `workspace_id`.
- **Active Record Pattern**: Exclusive use of TypeORM Active Record. Repositories and repository abstractions are strictly forbidden.
- **Decoupled Asynchrony**: Latency-sensitive workloads (such as incoming Meta webhooks) are enqueued immediately to BullMQ and processed asynchronously.
- **Auditing without Coupling**: Business services never insert audit logs directly; they emit `audit.record` events over `EventEmitter2`.

---

## 2. Mandatory Technology Stack

### Backend
- **Framework**: NestJS with TypeScript
- **ORM**: TypeORM using **Active Record pattern ONLY** (`BaseEntity` inheritance)
- **Database**: PostgreSQL (primary) + TimescaleDB (for high-volume audit logs)
- **Queues & Cache**: Redis + BullMQ
- **Request Context**: `nestjs-cls` (propagates `workspace_id` and `user_id`)
- **Event Bus**: `EventEmitter2` (`@nestjs/event-emitter`)
- **Logging**: `nestjs-pino` with structured JSON output (no `console.log`)
- **Validation**: `class-validator` and `class-transformer`
- **Documentation**: Swagger/OpenAPI (`@nestjs/swagger`)

### Frontend
- **Framework**: Next.js 14+ (App Router) with TypeScript
- **Styling**: Tailwind CSS v4 with semantic tokens
- **Component Primitives**: Radix UI + Shadcn UI patterns
- **State Management**: Zustand (client state) + TanStack React Query v5 (server state)
- **HTTP Client**: Centralized Axios with token and `x-workspace-id` interceptors
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod
- **Theming**: `next-themes` (Dark Pitch-Black Obsidian default, Light mode supported)

---

## 3. Strict Prohibitions
1. **No Alternative ORMs**: Never introduce Prisma, Drizzle, Sequelize, or MikroORM.
2. **No Repository Pattern**: Do not inject or define `Repository`, `GenericRepository`, `RepositoryService`, or `BaseRepository`.
3. **No Heavy Architectural Abstractions**: Do not introduce CQRS, DDD, or Hexagonal Architecture. Keep domain modules clear and direct: `Controller -> Service -> Active Record Entity`.
4. **No Raw Logging**: Never use `console.log`, `console.warn`, or `console.error` in production code. Use Pino.
5. **No Synchronous Webhook Processing**: Meta webhook POST endpoints must never perform synchronous external API calls or heavy database transactions before responding.
6. **No Arbitrary Colors**: Never use unstyled Tailwind gray classes like `bg-gray-100` or `text-gray-500`. Use semantic tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`).

---

## 4. Multi-Tenancy Invariants
- `workspace_id` must originate from the `x-workspace-id` HTTP header.
- The user's membership and permission within that workspace must be validated in an authentication/tenant guard before entering controllers.
- Validated `workspace_id` and `user_id` are stored in `nestjs-cls` request context.
- All tenant entities extend `TenantBaseEntity`, which automatically assigns `workspace_id`, `created_by_id`, and `updated_by_id` during `@BeforeInsert()` and `@BeforeUpdate()`.
- Client-supplied `workspace_id` in request payloads must NEVER be trusted.

---

## 5. Standard CRUD Naming Conventions
All standard CRUD operations in services and controllers must use:
- `GetAll()`
- `GetById()`
- `Insert()`
- `Update()`
- `Delete()`

Never use `findAll()`, `findOne()`, `create()`, `remove()`, etc.
