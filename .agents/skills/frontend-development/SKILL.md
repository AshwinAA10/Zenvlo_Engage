---
name: frontend-development
description: Frontend architectural guidelines, Next.js App Router rules, Tailwind v4 design system, state management, and UI component standards for Zenvlo Engage.
---

# Zenvlo Engage — Frontend Development Skill

## 1. Directory Structure
All frontend code resides under `frontend/src/`:
```text
frontend/src/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── chats/page.tsx
│   │   ├── campaigns/page.tsx
│   │   ├── contacts/page.tsx
│   │   ├── workflows/page.tsx
│   │   ├── ai-agents/page.tsx
│   │   ├── channels/page.tsx
│   │   └── settings/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/ (Radix/Shadcn primitives)
│   ├── DashboardShell.tsx
│   ├── ZenvloLogo.tsx
│   └── theme-provider.tsx
├── lib/
│   ├── axios.ts (centralized API client)
│   └── utils.ts
├── providers/
│   └── QueryProvider.tsx
└── stores/
    └── authStore.ts
```

---

## 2. Design System: Pitch-Black Obsidian + Emerald
- **Background**: `#000000` (Pitch black)
- **Cards & Popovers**: `#09090b` (Obsidian)
- **Secondary / Muted**: `#18181b`
- **Borders**: `#27272a`
- **Primary Text**: `#F8FAFC`
- **Muted Text**: `#A1A1AA`
- **Emerald Accent**:
  - Primary: `#10B981`
  - Hover: `#059669`
  - Translucent: `rgba(16, 185, 129, 0.15)`
  - Glow: `shadow-[0_4px_14px_rgba(16,185,129,0.25)]`

### Semantic Classes
Always use semantic tokens defined in Tailwind/CSS:
- `bg-background`, `bg-card`, `bg-muted`
- `text-foreground`, `text-muted-foreground`
- `border-border`
- `text-primary`, `bg-primary`, `hover:bg-primary-hover`
Never hardcode ad-hoc gray utility classes (`bg-gray-100`, `text-gray-400`).

---

## 3. State Management
- **Client State**: Zustand (`stores/authStore.ts`, etc.) for user session, active workspace ID, sidebar toggle state.
- **Server State**: TanStack React Query v5 (`useQuery`, `useMutation`). Never replicate cached server data inside Zustand.

---

## 4. Centralized Axios Instance
All HTTP requests must go through `src/lib/axios.ts`:
```typescript
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
});

apiClient.interceptors.request.use((config) => {
  const { token, currentWorkspaceId } = useAuthStore.getState();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (currentWorkspaceId) {
    config.headers['x-workspace-id'] = currentWorkspaceId;
  }
  return config;
});
```

---

## 5. Forms and Accessibility
- Build all forms using `react-hook-form` + `zod` validation resolvers.
- Always implement 4 distinct UI states for data screens: **Loading**, **Success**, **Empty**, and **Error**.
- Ensure keyboard focus styles, accessible ARIA attributes, and readable contrast.
