# Zenvlo Engage — Backend Architecture

## Technology Stack
- **Framework**: NestJS (v10+)
- **Language**: TypeScript (strict mode)
- **ORM**: TypeORM Active Record (`BaseEntity`)
- **Logging**: `nestjs-pino` with structured JSON format
- **Context Storage**: `nestjs-cls` (Request-scoped ClsService)
- **Event Bus**: `EventEmitter2` (`@nestjs/event-emitter`)
- **Queue Engine**: BullMQ with Redis
- **Authentication**: Passport JWT + Guards
- **Validation**: `class-validator` + `class-transformer`
- **Documentation**: Swagger / OpenAPI (`/api/docs`)

---

## Directory Organization
The backend follows strict domain grouping:
```text
backend/src/
├── common/             # Shared constants, decorators, utilities
├── config/             # Environment configuration schemas
├── database/           # BaseTable, TenantBaseEntity, migrations, dataSource
├── filters/            # Global HttpExceptionFilter
├── guards/             # JwtAuthGuard, TenantGuard, RolesGuard
├── interceptors/       # Logging and response transformers
├── middleware/         # TenantContextMiddleware
├── pipes/              # ValidationPipe
├── queues/             # BullMQ queue configuration
├── events/             # Shared system events
└── modules/
    ├── Tenant/         # Workspace, WorkspaceMember, Organization
    ├── System/         # Base entities, AuditLog, AuditListener, Health
    ├── Channel/        # WhatsApp WABA, Instagram Graph API
    ├── Contact/        # Contacts, Audiences, Segments
    ├── Conversation/   # Chats, Messages, WebSocket gateway
    ├── Campaign/       # Broadcast campaigns, templates
    ├── Workflow/       # Automation triggers & actions
    ├── Webhook/        # Meta webhook receiver & queueing
    ├── Queue/          # BullMQ queue management
    ├── Auth/           # JWT, login, tokens, password hashing
    └── User/           # User profiles & settings
```

---

## The Request Lifecycle
```text
Client Request (Headers: Authorization, x-workspace-id)
     ↓
TenantContextMiddleware / JwtAuthGuard
     ↓
Validate user JWT and workspace membership
     ↓
nestjs-cls context populated with:
  cls.set('workspace_id', validatedWorkspaceId)
  cls.set('user_id', validatedUserId)
     ↓
ValidationPipe (strip unwhitelisted body fields)
     ↓
Domain Controller (CRUD: GetAll, GetById, Insert, Update, Delete)
     ↓
Domain Service
     ↓
TypeORM Active Record (auto-sets workspace_id, created_by_id)
     ↓
Response or BullMQ Job Enqueued
```

---

## CRUD Method Name Policy
Controllers and services MUST uniformly name standard CRUD actions:
- `GetAll()`: List records within the workspace
- `GetById()`: Retrieve single record by UUID within the workspace
- `Insert()`: Create a new record
- `Update()`: Update an existing record
- `Delete()`: Soft-delete a record
