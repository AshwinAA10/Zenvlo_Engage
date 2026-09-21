# Zenvlo Engage

**Zenvlo Engage** is a standalone, multi-tenant SaaS platform within the Zenvlo ecosystem engineered for enterprise-grade WhatsApp and Instagram automation.

It operates seamlessly alongside the broader Zenvlo product suite:

```text
Zenvlo Ecosystem
 ├── CRM
 ├── Voice
 └── Engage (Multi-Channel WhatsApp & Instagram Automation)
```

Zenvlo Engage provides unified multi-channel messaging, broadcast campaigns, event-driven workflows, background queue processing, and autonomous AI agents—all engineered with bulletproof multi-tenant isolation, high concurrency, and real-time observability.

---

## 1. Architectural Stack

```text
Backend:
NestJS + TypeScript
  ├── TypeORM Active Record (Strict: No Generic Repositories)
  ├── PostgreSQL 16 + TimescaleDB (Hypertable Audit Logs)
  ├── Redis 7 + BullMQ (Asynchronous Task Queue & Rate-Limiting)
  ├── NestJS CLS (Strict Tenant Context Isolation via x-workspace-id)
  ├── EventEmitter2 (Decoupled Audit Logging)
  └── Pino (Structured JSON Logging — Zero console.log)

Frontend:
Next.js 15+ (App Router) + TypeScript
  ├── Tailwind CSS v4 (Pitch-Black Obsidian Design System)
  ├── Radix UI / Shadcn Primitives
  ├── TanStack React Query v5 (Server State & Caching)
  ├── Zustand (Client Auth & Tenant State Management)
  ├── Centralized Axios Interceptor (Auto Bearer & x-workspace-id)
  └── Lucide React (Icons)
```

---

## 2. Directory Structure

```text
Zenvlo_Engage/
├── .agents/
│   └── skills/                  # 8 Architectural & Development Agent Skills
│       ├── api-development
│       ├── backend-development
│       ├── database-development
│       ├── frontend-development
│       ├── module-development
│       ├── project-architecture
│       ├── security
│       └── testing
├── backend/
│   ├── src/
│   │   ├── common/              # Filters, Guards, Interceptors, Middleware, Pipes
│   │   ├── config/              # Environment validation & app configuration
│   │   ├── database/            # BaseTable, TenantBaseEntity, migrations, dataSource
│   │   └── modules/             # 11 Modular Domain Boundaries
│   │       ├── Auth/            # Authentication & JWT issuance
│   │       ├── Campaign/        # Broadcast campaigns & recipient tracking
│   │       ├── Channel/         # WhatsApp & Instagram integration
│   │       ├── Contact/         # Contact & audience segmentation
│   │       ├── Conversation/    # Real-time multi-channel inbox & messaging
│   │       ├── Queue/           # BullMQ queue processors & job producers
│   │       ├── System/          # Base entities, audit logs, health checks
│   │       ├── Tenant/          # Workspace & member management
│   │       ├── User/            # User profile management
│   │       ├── Webhook/         # Low-latency (<50ms) Meta webhook ingestion
│   │       └── Workflow/        # Automation triggers, actions & execution engine
│   ├── test/                    # Jest E2E test suites
│   └── package.json
├── docs/
│   ├── architecture/            # Architectural blueprints & invariant specifications
│   │   ├── backend.md
│   │   ├── database.md
│   │   ├── frontend.md
│   │   └── overview.md
│   └── development/
│       └── workflow.md          # 6-step module lifecycle guide
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router routes & layouts
│   │   │   ├── (auth)/login/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── ai-agents/
│   │   │   │   ├── campaigns/
│   │   │   │   ├── channels/
│   │   │   │   ├── chats/
│   │   │   │   ├── contacts/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── settings/
│   │   │   │   └── workflows/
│   │   │   ├── globals.css      # Pitch-black Obsidian theme tokens
│   │   │   └── layout.tsx
│   │   ├── components/          # UI primitives & Dashboard layout
│   │   ├── hooks/               # Custom React hooks
│   │   ├── lib/                 # Centralized Axios client & utilities
│   │   ├── providers/           # QueryProvider & ThemeProvider
│   │   ├── store/               # Zustand authStore
│   │   └── types/               # TypeScript interfaces & API contracts
│   └── package.json
├── docker-compose.yml           # TimescaleDB & Redis infrastructure
├── .env.example
├── .gitignore
└── README.md
```

---

## 3. Port Mappings & Service Endpoints

| Service | Port | Endpoint / URL | Purpose |
|---|---|---|---|
| **Frontend Web App** | `3000` | `http://localhost:3000` | Next.js 15+ Obsidian Dashboard |
| **Backend REST API** | `3001` | `http://localhost:3001/api` | NestJS Core API Engine |
| **Swagger / OpenAPI** | `3001` | `http://localhost:3001/api/docs` | Interactive API Documentation |
| **Health Check** | `3001` | `http://localhost:3001/api/health` | Service & DB Health Probe |
| **Meta Webhook Endpoint** | `3001` | `http://localhost:3001/api/webhooks/meta` | Low-latency Webhook Ingestion |
| **PostgreSQL + TimescaleDB** | `5432` | `localhost:5432` | Primary Database & Audit Hypertables |
| **Redis** | `6379` | `localhost:6379` | BullMQ Task Queue & Distributed Cache |

---

## 4. Getting Started

### Prerequisites
- Node.js >= 20.x
- Docker & Docker Compose
- npm or pnpm

### Step 1: Clone and Configure Environment
```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

### Step 2: Start Infrastructure (Database & Redis)
```bash
docker compose up -d
```

### Step 3: Install & Start Backend
```bash
cd backend
npm install
npm run start:dev
```
Backend will start on `http://localhost:3001`. Swagger documentation will be accessible at `http://localhost:3001/api/docs`.

### Step 4: Install & Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend will be live at `http://localhost:3000`.

---

## 5. Testing & Build Commands

### Backend
```bash
cd backend

# Run Unit Tests
npm test

# Run E2E Tests
npm run test:e2e

# Compile Production Build
npm run build
```

### Frontend
```bash
cd frontend

# Run Linter
npm run lint

# Compile Production Build
npm run build

# Start Production Server
npm run start
```

---

## 6. TypeORM Database Migrations

Zenvlo Engage follows strict Active Record conventions. Migrations must be generated and executed using the designated CLI scripts:

```bash
cd backend

# Generate a new migration based on entity changes
npm run migration:generate -- src/database/migrations/NewMigrationName

# Run pending migrations
npm run migration:run

# Revert the latest migration
npm run migration:revert
```

---

## 7. Development Invariants & Rules

1. **TypeORM Active Record Exclusivity**:
   - Entities must extend `BaseTable` or `TenantBaseEntity`.
   - Never inject `Repository<T>` or create generic repositories.
   - Use direct entity class methods (`Entity.find()`, `Entity.findOne()`, `Entity.save()`).

2. **Mandatory Tenant Context Isolation**:
   - All domain tables must include `workspace_id` indexed foreign keys.
   - Tenant context is propagated automatically via `nestjs-cls` through the `x-workspace-id` request header.
   - Never trust client-supplied tenant identifiers in request payloads.

3. **Standardized CRUD Naming**:
   - Every service and controller adheres to: `GetAll()`, `GetById()`, `Insert()`, `Update()`, `Delete()`.

4. **Low-Latency Asynchronous Webhook Ingestion**:
   - Meta webhook payloads (`/api/webhooks/meta`) must be validated and enqueued to BullMQ in `< 50ms`, immediately returning `200 OK`.
   - Business processing is performed asynchronously by background queue workers.

5. **Decoupled Auditing**:
   - Services must emit `audit.record` events via `EventEmitter2`.
   - The centralized `AuditListener` captures events and writes to TimescaleDB hypertable logs without coupling domain logic.

6. **Structured Observability**:
   - Zero `console.log` permitted in code. Always use `PinoLogger`.

---

## 8. Development Workflow

When implementing new business modules or expanding existing domains, developers and AI agents must follow the mandatory 6-step lifecycle:

```text
[1. Understand] ➔ [2. Inspect] ➔ [3. Design] ➔ [4. Implement] ➔ [5. Verify] ➔ [6. Review]
```
For complete guidelines, see [docs/development/workflow.md](file:///c:/Users/ashwi/Documents/Zenvlo_Engage/docs/development/workflow.md).
