# agent-platform-web

Next.js web portal for the AI Agent Platform. Create and manage agents, trigger runs, stream output in real time, browse skills, and manage LLM API keys — all from the browser.

> **Status**: Phase 3 complete — 35 files, 3.1K lines, 12 pages, dark theme. Connected to agent-platform-api.

---

## Quick Start

```bash
# Install dependencies
npm install

# Configure API endpoint
cp .env.example .env.local
# Edit NEXT_PUBLIC_API_URL (default: http://localhost:8080)

# Start dev server
npm run dev
```

Requires [agent-platform-api](https://github.com/bitop-dev/agent-platform-api) running.

---

## Pages

| Route | Description |
|---|---|
| `/login` | Email/password login |
| `/register` | New account registration |
| `/` | **Dashboard** — stat cards (agents, total runs, succeeded, failed), recent runs list |
| `/agents` | **Agent list** — card grid with status badges, create/delete |
| `/agents/new` | **Create agent** — name, description, system prompt editor, provider/model picker, max turns, timeout |
| `/agents/[id]` | **Agent detail** — configuration display, quick-run input, run history |
| `/agents/[id]/edit` | **Edit agent** — full form with enable/disable toggle |
| `/runs` | **Runs table** — mission, model, status badge, turns, duration, created date |
| `/runs/[id]` | **Run monitor** — live streaming output, collapsed event timeline, stop button |
| `/skills` | **Skills browser** — card grid with tier badges, version, tags |
| `/settings/api-keys` | **API key management** — add/delete, provider selector, base URL, default toggle |

---

## Architecture

```
src/
  app/
    layout.tsx              Root layout (dark theme, providers, auth guard)
    login/page.tsx          Login form
    register/page.tsx       Registration form
    (app)/                  Authenticated route group
      layout.tsx            Sidebar + main content area
      page.tsx              Dashboard
      agents/
        page.tsx            Agent list
        new/page.tsx        Create agent form
        [id]/page.tsx       Agent detail + quick run
        [id]/edit/page.tsx  Edit agent form
      runs/
        page.tsx            Runs table
        [id]/page.tsx       Run monitor (streaming + timeline)
      skills/page.tsx       Skills browser
      settings/
        api-keys/page.tsx   API key management
  components/
    providers.tsx           React Query + Sonner toast provider
    sidebar.tsx             Navigation sidebar
    auth-guard.tsx          Auth redirect guard
    ui/                     shadcn/ui components (14 components)
  lib/
    api.ts                  Typed API client (all endpoints + WebSocket)
    store.ts                Zustand auth store
    utils.ts                Tailwind merge utility
```

### State Management

| Layer | Tool | Purpose |
|---|---|---|
| Server state | **TanStack React Query** | All API calls, caching (30s stale), auto-refetch |
| Auth state | **Zustand** | User, tokens, login/logout/register actions |
| Real-time | **WebSocket** (native) | Run event streaming |

### API Client (`src/lib/api.ts`)

Typed client covering all platform API endpoints:

```typescript
import { agents, runs, apiKeys, skills, models, dashboard, auth } from "@/lib/api";

// All return typed responses
const { agents: list } = await agents.list();
const agent = await agents.create({ name: "Bot", system_prompt: "...", model_name: "gpt-4o" });
const run = await runs.create(agentId, "What is 2+2?");
const { events } = await runs.events(runId);
```

Features:
- **Auto token refresh**: on 401, tries refresh token → retries request → redirects to login on failure
- **Type-safe**: all request/response types defined as TypeScript interfaces
- **WebSocket helper**: `connectRunStream(runId, onEvent, onClose)` for live run streaming

### Auth Flow

1. Login/register → API returns access token (60 min) + refresh token (7 days)
2. Tokens stored in `localStorage` via Zustand store
3. Every API request includes `Authorization: Bearer <access_token>`
4. On 401 → auto-refresh with refresh token → retry original request
5. If refresh fails → clear tokens → redirect to `/login`
6. Auth guard component prevents unauthenticated access to `(app)` routes

### Run Monitor

The `/runs/[id]` page provides real-time run monitoring:

**Output pane** (left, 2/3 width):
- Streaming text output as the agent responds
- Auto-scrolls to bottom
- Shows `output_text` from DB for completed runs

**Timeline panel** (right, 1/3 width):
- **Agent started** / **Agent finished** markers with turn count and duration
- **Tool calls**: `⚡ http_fetch` (executing) → `✓ http_fetch` (success, char count) or `✗ http_fetch` (error)
- **Streaming output**: single collapsed row showing chunk count (not individual deltas)
- **Expandable**: click any tool call to see arguments or output preview
- Color-coded: blue=start, yellow=tools, green=success, red=errors, purple=text

**Controls**:
- Stop button (calls `POST /runs/:id/cancel`)
- Auto-polling: refetches run status every 2s while active
- Stats bar: turns, duration, token count

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 15** (App Router, Turbopack) |
| UI Components | **shadcn/ui** (14 components) |
| Styling | **Tailwind CSS** (dark theme) |
| Icons | **Lucide React** |
| Server State | **TanStack React Query** |
| Auth State | **Zustand** |
| Notifications | **Sonner** (toast) |
| Real-time | **WebSocket** (native browser API) |

### shadcn/ui Components Used

avatar, badge, button, card, dialog, input, label, scroll-area, select, separator, skeleton, sonner, switch, table, tabs, textarea

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | Platform API base URL |

---

## Build

```bash
npm run build    # Production build
npm run dev      # Dev server (Turbopack)
npm run lint     # ESLint
```

---

## Part of the Agent Platform

| Repo | Purpose | Status |
|---|---|---|
| [agent-core](https://github.com/bitop-dev/agent-core) | Standalone CLI + Go library | ✅ 111 tests |
| [agent-platform-api](https://github.com/bitop-dev/agent-platform-api) | REST API server | ✅ 22 tests |
| **agent-platform-web** (this repo) | Next.js web portal | ✅ 12 pages |
| [agent-platform-docs](https://github.com/bitop-dev/agent-platform-docs) | Architecture & planning | ✅ Comprehensive |

---

## License

TBD
