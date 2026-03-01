# Agent Platform Web

Next.js web portal for the AI Agent Platform. Provides a browser-based UI for managing agents, triggering runs, streaming output in real time, and managing LLM API keys.

## Pages

| Route | Description |
|---|---|
| `/` | Dashboard — agent count, run stats, recent runs |
| `/agents` | Agent list with create/delete |
| `/agents/new` | Create agent form (model picker, system prompt) |
| `/agents/[id]` | Agent detail with quick run, config, run history |
| `/runs` | All runs table |
| `/runs/[id]` | Run detail — live streaming output, event timeline, stop button |
| `/skills` | Skills browser |
| `/settings/api-keys` | LLM API key management |
| `/login` | Login |
| `/register` | Registration |

## Tech Stack

- **Next.js 15** (App Router)
- **shadcn/ui** + Tailwind CSS
- **Zustand** for auth state
- **TanStack React Query** for server state
- **WebSocket** for live run streaming

## Setup

```bash
cp .env.example .env.local
# Edit NEXT_PUBLIC_API_URL to point to your platform-api

npm install
npm run dev
```

Requires [agent-platform-api](https://github.com/bitop-dev/agent-platform-api) running.

## API Client

`src/lib/api.ts` — typed client for all platform API endpoints with auto-refresh token handling.

## Auth

JWT-based. Access token (60 min) stored in localStorage. Refresh token (7 days) auto-refreshes on 401. Auth guard redirects unauthenticated users to `/login`.
