---
name: api-development
description: REST API conventions, standard CRUD endpoints, DTO validation, Swagger/OpenAPI documentation, and webhook standards for Zenvlo Engage.
---

# Zenvlo Engage — API Development Skill

## 1. REST Conventions & Controller Separation
- Base path for API routes: `/api/v1/{resource}`
- Controllers handle HTTP transport only (decorating routes, executing validation pipes, invoking services, returning standard response models).
- Business validation and workflow orchestration belong inside domain services.

---

## 2. Standard CRUD Endpoints
Controllers must map standard HTTP verbs to the required CRUD methods:
```typescript
@Controller('contacts')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Get()
  async GetAll() {
    return this.contactService.GetAll();
  }

  @Get(':id')
  async GetById(@Param('id', ParseUUIDPipe) id: string) {
    return this.contactService.GetById(id);
  }

  @Post()
  async Insert(@Body() dto: CreateContactDto) {
    return this.contactService.Insert(dto);
  }

  @Put(':id')
  async Update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactService.Update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async Delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.contactService.Delete(id);
  }
}
```

---

## 3. Swagger / OpenAPI Documentation
- All controllers and endpoints must be decorated with `@ApiTags()`, `@ApiOperation()`, `@ApiResponse()`, and `@ApiBearerAuth()`.
- Document query parameters, request body schemas, and response DTOs.
- Swagger UI must be served at `/api/docs`.

---

## 4. Webhook Ingestion Conventions
Meta WhatsApp and Instagram webhook endpoints must follow this invariant pattern:
```typescript
@Post('webhooks/meta')
@HttpCode(HttpStatus.OK)
async handleMetaWebhook(@Req() req: Request, @Body() body: any) {
  // 1. Verify HMAC SHA256 signature from x-hub-signature-256 header
  this.webhookService.verifyMetaSignature(req);

  // 2. Quickly enqueue to BullMQ queue (< 50ms)
  await this.webhookQueue.add('meta-event', body);

  // 3. Return 200 OK immediately
  return { status: 'received' };
}
```
Never perform lengthy database queries or external API calls inside webhook controller handlers.
