---
name: security
description: Security principles, tenant isolation, JWT authentication, authorization, secret management, and webhook verification for Zenvlo Engage.
---

# Zenvlo Engage — Security Skill

## 1. Authentication & JWT Strategy
- All non-public endpoints require valid JWT authentication via `JwtAuthGuard`.
- Access tokens have short TTLs (e.g. 15-60 minutes).
- Refresh tokens are stored securely in HTTP-only cookies or encrypted stores.
- JWT payload contains `sub` (user_id), `email`, and accessible workspaces.

---

## 2. Multi-Tenant Authorization & Isolation
- The `TenantGuard` verifies that the `x-workspace-id` header passed in the request belongs to the authenticated user and matches their active organization/workspace memberships.
- Verified `workspace_id` is set into `nestjs-cls` request context.
- Never trust `workspace_id` sent in request bodies or query parameters.
- Every Active Record query must explicitly include `workspace_id: currentWorkspaceId` unless querying through an already validated entity instance.
- Automatic entity hooks (`@BeforeInsert`, `@BeforeUpdate`) in `TenantBaseEntity` prevent missing tenant identifiers.

---

## 3. Secret Management & Sanitization
- Never commit `.env`, private keys, or API tokens to source control.
- Pino logging must sanitize sensitive headers (`Authorization`, `cookie`) and properties (`password`, `token`, `secret`, `credit_card`).
- Meta app secrets (`META_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `INSTAGRAM_APP_SECRET`) must be retrieved strictly from environment variables.

---

## 4. Webhook Security
- WhatsApp & Instagram webhooks verify the `X-Hub-Signature-256` HTTP header using HMAC SHA-256 with `META_APP_SECRET`.
- Reject requests with invalid signatures with `401 Unauthorized` or `403 Forbidden`.
- GET verification requests must validate `hub.verify_token` against `WHATSAPP_VERIFY_TOKEN` and return `hub.challenge`.

---

## 5. Security Headers & CORS
- Backend enables Helmet (`helmet()`) for security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, etc.).
- Strict CORS rules restricting origins to the configured frontend domain in production.
- Global rate-limiting (`@nestjs/throttler`) applied to public auth and webhook routes.
