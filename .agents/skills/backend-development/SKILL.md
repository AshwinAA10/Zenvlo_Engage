---
name: backend-development
description: Backend conventions, NestJS patterns, TypeORM Active Record usage, DTOs, logging, BullMQ, and event handling for Zenvlo Engage.
---

# Zenvlo Engage — Backend Development Skill

## 1. Domain Structure
Backend modules are placed under `src/modules/{DomainName}/`:
```text
src/modules/{DomainName}/
├── {DomainName}.module.ts
├── controllers/
├── services/
├── entities/
└── models/ (or dtos/)
```

Domains:
- `Tenant`: Workspace, WorkspaceMember, Organization
- `System`: BaseTable, TenantBaseEntity, AuditLog, GlobalConfig
- `Channel`: WhatsApp WABA, Instagram Graph API
- `Contact`: Contact, Audience, Segment
- `Conversation`: Conversation, Message, Participant, Inbox, WebSocket
- `Campaign`: Campaign, CampaignRecipient, Template
- `Workflow`: WorkflowDefinition, WorkflowExecution, Trigger, Action
- `Webhook`: WebhookReceiver, WebhookEvent
- `Queue`: BullMQ Producers & Consumers
- `Auth`: JWT, Guards, Passport Strategies
- `User`: User profile management

---

## 2. TypeORM Active Record
Entities MUST extend the base classes and implement queries using Active Record:
```typescript
@Entity('contacts')
export class Contact extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 255 })
  first_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  phone_number: string;
}

// In Service:
const contacts = await Contact.find({
  where: { workspace_id: currentWorkspaceId, status: 1 },
});
```
Do NOT inject `Repository<Contact>`. Active Record methods (`find`, `findOne`, `save`, `softRemove`, `count`, etc.) are called directly on the entity class.

---

## 3. CRUD Naming Mandate
Services and controllers MUST implement the following method names for standard operations:
```typescript
export class ContactService {
  async GetAll(): Promise<Contact[]> { ... }
  async GetById(id: string): Promise<Contact> { ... }
  async Insert(dto: CreateContactDto): Promise<Contact> { ... }
  async Update(id: string, dto: UpdateContactDto): Promise<Contact> { ... }
  async Delete(id: string): Promise<void> { ... }
}
```

---

## 4. DTOs and Validation
- Every incoming payload must be typed with a DTO class.
- Use `class-validator` decorators (`@IsString()`, `@IsUUID()`, `@IsOptional()`, etc.).
- Global `ValidationPipe` must be configured with `whitelist: true` and `forbidNonWhitelisted: true`.
- Never trust client IDs for tenant assignment.

---

## 5. Audit Event Architecture
Services must never call `AuditLog.save()` directly.
Instead, inject `EventEmitter2`:
```typescript
this.eventEmitter.emit('audit.record', {
  workspace_id: workspaceId,
  actor_id: userId,
  action: 'CONTACT_CREATED',
  entity_name: 'Contact',
  entity_id: contact.id,
  metadata: { phone: contact.phone_number },
});
```
An `AuditListener` in `System` module catches `audit.record` and persists it.

---

## 6. BullMQ & Async Webhooks
- Webhook endpoints must validate HMAC signature / verify token, enqueue the payload via BullMQ immediately, and return `200 OK` or `204 No Content` within < 200ms.
- BullMQ worker processors pick up the job and execute the heavy business logic asynchronously.

---

## 7. Logging and Error Handling
- Inject `PinoLogger` or use `Logger` from `nestjs-pino`.
- Never use `console.log`.
- Always throw NestJS `HttpException` (e.g. `NotFoundException`, `ForbiddenException`, `BadRequestException`).
- Global `HttpExceptionFilter` formats clean JSON without leaking stack traces, SQL syntax, or internal tokens.
