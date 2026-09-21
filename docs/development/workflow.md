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
```bash
# Backend unit & integration tests
npm --prefix backend run test

# Backend build validation
npm --prefix backend run build

# Frontend tests & build
npm --prefix frontend run test
npm --prefix frontend run build
```
