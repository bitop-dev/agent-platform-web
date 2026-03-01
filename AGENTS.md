# AGENTS.md

Instructions for AI coding agents working on the agent-platform-web codebase.

## Project Overview

Next.js 15 web portal for the AI Agent Platform. Provides browser-based UI for managing agents, runs, skills, and API keys.

## Tech Stack

- **Next.js 15** with App Router (not Pages Router)
- **TypeScript** strict mode
- **shadcn/ui** components in `src/components/ui/`
- **Tailwind CSS** with dark theme (`className="dark"` on `<html>`)
- **TanStack React Query** for all server state / API calls
- **Zustand** for auth state management
- **Sonner** for toast notifications
- **Lucide React** for icons

## Architecture

### Route Groups

- `src/app/(app)/` — authenticated routes (wrapped in sidebar layout)
- `src/app/login/` and `src/app/register/` — public routes (no sidebar)
- Auth guard in `src/components/auth-guard.tsx` redirects unauthenticated users

### API Client

All API calls go through `src/lib/api.ts`. This is the single source of truth for:
- Endpoint URLs
- Request/response types
- Auto token refresh on 401
- WebSocket connection helper

**Never call `fetch()` directly** — use the typed functions from `api.ts`.

### State

- **Server state**: Use `useQuery` / `useMutation` from React Query. Key naming: `["agents"]`, `["agent", id]`, `["runs"]`, `["run", id]`, etc.
- **Auth state**: Use `useAuth()` from `src/lib/store.ts`. Provides `user`, `login()`, `register()`, `logout()`, `loadUser()`.
- **No Redux, no Context for data** — only React Query + Zustand.

### Components

- UI primitives in `src/components/ui/` (shadcn — do not modify these directly)
- App components in `src/components/` (sidebar, providers, auth-guard)
- Page-specific components stay in the page file unless reused

## Conventions

- All pages are `"use client"` (client components)
- Use `toast.success()` / `toast.error()` from Sonner for user feedback
- Use `useMutation` with `onSuccess` → `invalidateQueries` for write operations
- Use `Badge` with variant for status indicators
- Skeleton loading states (not spinners) for page loads
- `truncate` / `line-clamp-2` for long text in cards/lists

## API Base URL

Configured via `NEXT_PUBLIC_API_URL` env var. Defaults to `http://localhost:8080`.

The API server is [agent-platform-api](https://github.com/bitop-dev/agent-platform-api) — see its README for all endpoints.

## Commands

```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Production build (verify no errors)
npm run lint     # ESLint check
```
