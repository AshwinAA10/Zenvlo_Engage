---
name: module-development
description: Mandatory 6-step workflow for developing future business modules in Zenvlo Engage without breaking architectural invariants.
---

# Zenvlo Engage — Module Development Skill

When asked to create any future module (e.g., Campaigns, Conversations, Contacts, Workflows, Channels, AI Agents), you MUST strictly follow this 6-step procedure:

```text
Step 1: Understand
      ↓
Step 2: Inspect
      ↓
Step 3: Design
      ↓
Step 4: Implement
      ↓
Step 5: Verify
      ↓
Step 6: Review
```

---

## Step 1: Understand
Clarify and document:
- **Business Purpose**: What problem does this module solve?
- **Actors & Permissions**: Who can view, create, edit, or execute actions?
- **Entities & Data Model**: What entities are required? Do all tenant entities extend `TenantBaseEntity`?
- **Asynchronous Requirements**: Does this module involve long-running jobs, webhooks, or third-party API interactions (BullMQ)?
- **Audit Logging**: What user or system actions must emit `audit.record` events?

---

## Step 2: Inspect
Search the existing codebase for existing patterns:
- Check existing modules under `backend/src/modules/`
- Check entity hierarchy and existing migration files
- Check controllers for the mandatory `GetAll()`, `GetById()`, `Insert()`, `Update()`, `Delete()` naming
- Check frontend routes, navigation items, and shared UI components in `frontend/src/`

---

## Step 3: Design
Produce a concrete implementation plan covering:
1. **Database**: Entity schemas extending `TenantBaseEntity`, indexes, relations, migration file.
2. **Backend**: Domain module in `src/modules/{DomainName}/`, controller, service, DTOs, BullMQ queue/worker (if async).
3. **API & Swagger**: OpenAPI decorators, error handling, route guards (`JwtAuthGuard`, `TenantGuard`).
4. **Events & Audits**: Definition of domain events and audit log payloads.
5. **Frontend**: Route under `(dashboard)/{module}/page.tsx`, components, React Query hooks, Zustand store (if needed), Zod validation schemas.
6. **Testing Plan**: Unit tests, tenant isolation test, validation test.

---

## Step 4: Implement
Implement in strict dependency order:
1. Database entity classes and migration.
2. DTOs with `class-validator` rules.
3. Domain service with standard CRUD methods (`GetAll`, `GetById`, `Insert`, `Update`, `Delete`) using Active Record.
4. Domain controller with Swagger documentation.
5. NestJS module registration in `app.module.ts`.
6. BullMQ queues/processors or event listeners (if applicable).
7. Frontend API client endpoints / React Query hooks.
8. Frontend UI components and pages with full Loading, Success, Empty, and Error states.

---

## Step 5: Verify
Execute automated quality checks:
- Type check backend: `npm --prefix backend run build`
- Type check frontend: `npm --prefix frontend run build`
- Run test suites: `npm --prefix backend run test` and `npm --prefix frontend run test`
- Verify linting and formatting.

---

## Step 6: Review
Perform a final audit against prohibited actions:
- [ ] Are all tenant entities extending `TenantBaseEntity`?
- [ ] Is TypeORM Active Record used exclusively (no `Repository<T>`)?
- [ ] Are controller/service CRUD methods named `GetAll`, `GetById`, `Insert`, `Update`, `Delete`?
- [ ] Are audit records emitted via `eventEmitter.emit('audit.record')` instead of direct DB writes?
- [ ] Are webhook POST routes non-blocking (enqueued to BullMQ)?
- [ ] Is `workspace_id` derived exclusively from CLS / JWT context rather than trusted request payloads?
- [ ] Is structured Pino logging used (zero `console.log`)?
- [ ] Does the UI use semantic design tokens and follow Pitch-Black Obsidian + Emerald?
