# Zenvlo Engage — Architecture Overview

## Executive Summary
**Zenvlo Engage** is a standalone, multi-tenant SaaS platform within the Zenvlo ecosystem designed for high-scale WhatsApp and Instagram automation.

The platform coordinates real-time conversations, scheduled and broadcast campaigns, event-driven workflows, background queue jobs, and AI agents while maintaining bulletproof tenant isolation.

---

## Architectural Principles

```text
┌─────────────────────────────────────────────────────────────┐
│                      Client / Webhook                       │
└──────────────────────────────┬──────────────────────────────┘
                               │
            HTTPS + JWT + x-workspace-id header
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                        NestJS API                           │
│  ├── Pino Structured Logger                                 │
│  ├── Global ValidationPipe (class-validator)                │
│  ├── JwtAuthGuard + TenantGuard                             │
│  ├── nestjs-cls (Request-scoped workspace_id & user_id)     │
│  ├── Controllers (GetAll, GetById, Insert, Update, Delete)  │
│  └── Services (Domain Logic)                                │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│   TypeORM Active Record      │ │       BullMQ + Redis        │
│   BaseTable                  │ │  ├── Webhook Ingestion Job  │
│       ↓                      │ │  ├── Message Delivery       │
│   TenantBaseEntity           │ │  └── Campaign Processing    │
│       ↓                      │ └─────────────────────────────┘
│   Domain Entities            │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│    PostgreSQL Primary DB     │ │        EventEmitter2        │
│   (Relational tenant data)   │ │              ↓              │
└──────────────────────────────┘ │        AuditListener        │
                                 │              ↓              │
                                 │    TimescaleDB Audit Store  │
                                 └─────────────────────────────┘
```

---

## Core Tenets
1. **Active Record Exclusivity**: Database queries are made directly through entity models extending `TenantBaseEntity` and `BaseTable`. Repositories are strictly prohibited.
2. **Strict Multi-Tenancy**: `workspace_id` is propagated securely via `nestjs-cls` and stamped automatically in `@BeforeInsert()` and `@BeforeUpdate()` hooks. Client payloads are never trusted for workspace assignment.
3. **Decoupled Auditing**: Direct writes to audit tables from business services are banned. Services fire `audit.record` events via `EventEmitter2`, which are captured and stored in a TimescaleDB hypertable by the `AuditListener`.
4. **Resilient Webhook Pipeline**: Webhook endpoints return `200 OK` in < 200ms by enqueuing payloads to BullMQ queues for background processing.
5. **Unified Design Language**: The frontend utilizes Next.js App Router, Tailwind CSS v4, and Radix UI primitives themed with Pitch-Black Obsidian (`#000000`, `#09090b`) and Emerald (`#10B981`) accents.
