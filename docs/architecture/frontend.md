# Zenvlo Engage — Frontend Architecture

## Technology Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Primitives**: Radix UI + Shadcn UI patterns
- **State Management**:
  - Client / UI State: Zustand
  - Server / Cache State: TanStack React Query v5
- **HTTP Client**: Centralized Axios with Bearer and `x-workspace-id` interceptors
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React
- **Theming**: `next-themes` (Dark Pitch-Black default, Light mode supported)

---

## Directory Organization
```text
frontend/src/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
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
│   ├── ui/                 # Button, Input, Card, Dialog, Dropdown, Badge
│   ├── DashboardShell.tsx  # Responsive sidebar, header, workspace switch
│   ├── ZenvloLogo.tsx      # SVG branding with collapsed/expanded mode
│   └── theme-provider.tsx  # next-themes wrapper
├── lib/
│   ├── axios.ts            # Centralized API client with interceptors
│   └── utils.ts            # Tailwind merge and classnames helper
├── providers/
│   └── QueryProvider.tsx   # React Query client provider
└── stores/
    └── authStore.ts        # Zustand store for token, user, active workspace
```

---

## Visual Identity: Pitch-Black Obsidian + Emerald
- **Background**: `#000000` (Pure pitch black)
- **Cards / Surfaces**: `#09090b` (Deep obsidian)
- **Secondary / Muted**: `#18181b`
- **Borders**: `#27272a`
- **Primary Text**: `#F8FAFC`
- **Muted Text**: `#A1A1AA`
- **Emerald Accent**:
  - Main: `#10B981`
  - Hover: `#059669`
  - Glow: `shadow-[0_4px_14px_rgba(16,185,129,0.25)]`
  - Translucent: `rgba(16, 185, 129, 0.15)`

All styles are exposed through semantic Tailwind tokens: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`.
