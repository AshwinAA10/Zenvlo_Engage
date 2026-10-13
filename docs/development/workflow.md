# Zenvlo Engage — Development Workflow

## The 6-Step Module Lifecycle
Every feature, module, or integration added to Zenvlo Engage follows this protocol:

```text
Step 1: Understand
Step 2: Inspect
Step 3: Design
Step 4: Implement
Step 5: Verify
Step 6: Review
```

Refer to `.agents/skills/module-development/SKILL.md` for the complete operational checklist.

---

## Local Setup & Development

### 1. Prerequisites
- Node.js >= 20
- Docker & Docker Compose (for PostgreSQL + Redis)
- npm >= 10

### 2. Starting Infrastructure
```bash
docker compose up -d
```
Starts:
- PostgreSQL 16 on port `5432`
- Redis 7 on port `6379`

### 3. Backend Development
```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```
- API starts on `http://localhost:4000/api`
- Swagger documentation: `http://localhost:4000/api/docs`
- Health check: `http://localhost:4000/api/health`

### 4. Frontend Development
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
- Web application starts on `http://localhost:3000`

---

## Testing & Quality Gates

All tests return standard process exit codes (`0` for success, non-zero for failures) to guarantee automated failure detection both locally and in CI.

### 1. Frontend Unit & Integration Tests (Vitest)
```bash
# Run all frontend unit and integration tests (single run)
npm --prefix frontend run test

# Run tests in interactive watch mode
npm --prefix frontend run test:watch

# Run a single test file
npx --prefix frontend vitest run src/components/auth/login-form.test.tsx

# Run tests matching a specific pattern or describe block
npx --prefix frontend vitest run -t "LoginForm"
```

### 2. Frontend Test Coverage
Measures V8 code coverage against established regression thresholds (35% statements, 30% branches, 25% functions, 35% lines):
```bash
# Run coverage and output text summary + HTML report (frontend/coverage/index.html)
npm --prefix frontend run test:coverage
```

### 3. Playwright End-to-End Tests
Playwright spins up the backend test server (`PORT=4001`) and Next.js frontend (`PORT=3000`) automatically against the isolated `zenvlo_engage_test` PostgreSQL database.

```bash
# Run all end-to-end tests headless
npm --prefix frontend run test:e2e

# Run a single E2E spec file
npx --prefix frontend playwright test e2e/testimonial-workflow.spec.ts

# Debug E2E tests interactively in Playwright UI mode
npm --prefix frontend run test:e2e:ui

# Debug E2E tests step-by-step with Playwright Inspector
npx --prefix frontend playwright test e2e/testimonial-workflow.spec.ts --debug

# View failure HTML report and inspect traces/screenshots
npx --prefix frontend playwright show-report frontend/playwright-report
```

### 4. Backend Regression Suite (Jest)
Runs the complete NestJS backend unit and service integration test suite:
```bash
npm --prefix backend run test
```

### 5. Complete Local Quality Gate
To verify all quality gates prior to opening a pull request or pushing to remote:
```bash
# 1. Backend regression suite
npm --prefix backend run test

# 2. Frontend lint & static check
npm --prefix frontend run lint

# 3. Frontend coverage & unit tests (enforces coverage thresholds)
npm --prefix frontend run test:coverage

# 4. Frontend production build validation
npm --prefix frontend run build

# 5. Full browser E2E test suite
npm --prefix frontend run test:e2e
```

