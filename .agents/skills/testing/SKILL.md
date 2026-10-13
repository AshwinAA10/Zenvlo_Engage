---
name: testing
description: Testing strategies, test runner setups, tenant isolation tests, and integration coverage for Zenvlo Engage.
---

# Zenvlo Engage — Testing Skill

## 1. Testing Hierarchy
Zenvlo Engage requires thorough test coverage across three layers:
1. **Unit Tests**:
   - Entities, BaseTable, and TenantBaseEntity lifecycle hooks (`@BeforeInsert`, `@BeforeUpdate`).
   - Domain services, validation DTOs, and utility functions.
2. **Integration Tests**:
   - NestJS modules with active TypeORM Active Record connections.
   - Event listeners (`AuditListener` receiving `audit.record` events).
   - Queue producers enqueuing jobs to BullMQ.
3. **E2E & Security Tests**:
   - JWT authentication flows and expired token handling.
   - **Tenant Isolation Tests**: Attempting to query or mutate a resource belonging to Workspace A using a token authorized only for Workspace B must result in `404 Not Found` or `403 Forbidden`.
   - Webhook HMAC signature verification tests.

---

## 2. Running Tests
- Backend Unit & Integration Tests:
  ```bash
  npm --prefix backend run test
  ```
- Backend E2E Tests:
  ```bash
  npm --prefix backend run test:e2e
  ```
- Frontend Unit & Component Tests (Vitest):
  ```bash
  npm --prefix frontend run test
  npm --prefix frontend run test:watch
  npm --prefix frontend run test:coverage
  ```
- Frontend E2E Tests (Playwright):
  ```bash
  # Prerequisite: ensure browsers are installed (one-time setup)
  npx --prefix frontend playwright install chromium

  # Run E2E tests headless against Next.js dev server
  npm --prefix frontend run test:e2e

  # Run E2E tests with interactive Playwright UI
  npm --prefix frontend run test:e2e:ui
  ```
- Complete Frontend Test Suite:
  ```bash
  npm --prefix frontend run test:all
  ```

---

## 3. Mocking & Test Isolation
- **Backend**:
  - Use NestJS `@nestjs/testing` module for building isolated test contexts.
  - Mock `ClsService` to provide deterministic `workspace_id` and `user_id` context values during service unit tests.
  - For TypeORM Active Record unit tests, utilize in-memory SQLite/Postgres test containers or spy on static Active Record methods (`find`, `findOne`, `save`).
- **Frontend**:
  - Use `renderWithProviders()` from `@test/utils/renderWithProviders` to mount components within isolated `QueryClientProvider` and `useAuthStore` instances.
  - Reset Zustand `useAuthStore` and clear `localStorage` in `test/setup.ts` before each test.
  - In Playwright E2E tests, execute against `http://localhost:3000` with automatic Next.js server initialization managed by `playwright.config.ts`.

