# agent-platform-web

Web portal for the Agent Platform. Built with Bun + Vite + React + shadcn/ui + Tailwind CSS v4.

> **Status**: Feature-complete. 37 source files (~5.1K lines), 16 pages, industrial "AgentOps Command Center" theme. CI/CD via GitHub Actions.

---

## Quick Start

```bash
# Install dependencies
bun install

# Dev server (hot reload)
bun run dev --port 3002

# Production build
bun run build

# Preview production build
bun run preview
```

Requires the API server running at `http://localhost:8090` (configurable via `.env`).

---

## Pages

| Route | Page | Description |
|---|---|---|
| `/login` | Login | Email/password + GitHub/Google OAuth buttons |
| `/register` | Register | New user registration |
| `/` | Dashboard | 4 stat cards + recent runs list |
| `/agents` | Agents | Card grid with create/delete |
| `/agents/new` | Create Agent | Name, description, system prompt, provider/model picker |
| `/agents/:id` | Agent Detail | Config display, quick-run, team assignment, run history |
| `/agents/:id/edit` | Edit Agent | Full form with enable/disable toggle |
| `/runs` | Runs | Filterable table with mission, model, status, turns, duration |
| `/runs/:id` | Run Monitor | Live streaming output + event timeline + child runs + stop |
| `/skills` | Skill Hub | Browse skills from all sources, add custom GitHub repos |
| `/schedules` | Schedules | Cron/interval/one-shot schedule management |
| `/teams` | Teams | Create teams, invite members, manage roles |
| `/audit-log` | Audit Log | Color-coded action badges, paginated entries |
| `/settings/api-keys` | API Keys | Add/delete provider keys with base URL support |
| `/settings/credentials` | Credentials | Per-user skill secrets (GITHUB_TOKEN, etc.) with LED status |
| `/workflows` | AI Teams | Multi-agent workflow builder, step dependencies, live run status |

---

## Design: AgentOps Command Center

The UI uses an industrial command center aesthetic:

- **Color palette**: dark charcoal background + amber/gold accents
- **Typography**: JetBrains Mono for data, system-ui for body text
- **LED indicators**: pulsing green (online), amber (warning), red (error)
- **Glow borders**: subtle amber glow on active cards and panels
- **Scan-line overlays**: CRT-inspired texture on header bars
- **Status badges**: hardware-inspired with colored dot indicators

### Key UI Features

- **OAuth avatars**: sidebar shows GitHub/Google profile picture for OAuth users
- **Team assignment**: dropdown on agent detail page to assign agents to teams
- **Run tree**: child runs displayed on run detail page with LED status + click-through
- **Live streaming**: WebSocket run output with collapsed event timeline
- **Skill sources**: add custom GitHub repos, sync, browse skills with tags and versions

---

## Architecture

```
src/
├── main.tsx              Entry point (BrowserRouter, QueryClient, Toaster)
├── App.tsx               Route definitions + ProtectedRoute wrapper
├── lib/
│   ├── api.ts            Typed API client (auth, agents, runs, skills, sources, keys,
│   │                     schedules, teams, audit-log, dashboard, models, OAuth)
│   ├── store.ts          Zustand auth store (login/register/logout/loadUser)
│   └── utils.ts          cn() helper
├── components/
│   ├── app-layout.tsx    Sidebar layout with nav, LED status, avatar display
│   └── ui/               14 shadcn/ui components
└── pages/
    ├── login.tsx          Email/password + OAuth buttons + token extraction
    ├── register.tsx
    ├── dashboard.tsx      Stat cards + recent runs
    ├── agents.tsx         Agent card grid
    ├── agents-new.tsx     Create agent form
    ├── agent-detail.tsx   Config, quick-run, team selector, run history
    ├── agent-edit.tsx     Full edit form
    ├── runs.tsx           Filterable run table with pagination
    ├── run-detail.tsx     Live streaming + event timeline + child runs
    ├── skills.tsx         Skill sources + skill browser
    ├── schedules.tsx      Schedule CRUD
    ├── teams.tsx          Team management + invitations
    ├── audit-log.tsx      Paginated audit trail
    └── api-keys.tsx       API key management
```

### Key Design Decisions

- **SPA with React Router** — no SSR needed, all data comes from the API
- **TanStack React Query** for server state — auto-caching, refetching, loading states
- **Zustand** for auth state — persists tokens in localStorage
- **Auto token refresh** — API client handles 401 → refresh → retry transparently
- **Dark theme only** — `class="dark"` on `<html>`, shadcn/ui new-york style
- **OAuth token delivery** — server redirects to `/login?token=...&refresh_token=...`, login page extracts and stores

### Run Monitor Features

- **Live streaming output** via WebSocket (`/ws/runs/:id`)
- **Event timeline** with collapsed view:
  - Text deltas collapsed into single "Streaming output (N chunks)" row
  - Tool calls shown prominently with ⚡ start / ✓ end badges
  - Expandable args and output for each tool call
  - Turn boundaries shown as status rows
- **Child runs** — sub-agent runs displayed with LED status indicators and click-through links
- **Stop button** — cancels running agents via `POST /runs/:id/cancel`
- **Auto-scroll** — output pane follows new content

---

## Docker

### Dockerfile

Multi-stage build: Bun install + Vite build → nginx serve.

```dockerfile
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile && bun run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

### nginx.conf

- SPA fallback: all routes → `index.html`
- `/api/` → proxy to API container
- `/ws` → WebSocket proxy to API container
- Gzip compression, static asset caching

### API URL Configuration

| Environment | `VITE_API_URL` | Result |
|---|---|---|
| **Docker** | (empty) | Relative URLs → nginx proxies to API |
| **Local dev** | `http://localhost:8090` | Direct to API server |

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | [Bun](https://bun.sh/) |
| Build | [Vite](https://vite.dev/) 7 |
| UI | [React](https://react.dev/) 19 |
| Routing | [React Router](https://reactrouter.com/) v6 |
| Styling | [Tailwind CSS](https://tailwindcss.com/) v4 + [@tailwindcss/vite](https://tailwindcss.com/docs/installation/vite) |
| Components | [shadcn/ui](https://ui.shadcn.com/) (14 components, new-york style) |
| Server State | [TanStack React Query](https://tanstack.com/query) |
| Client State | [Zustand](https://zustand.docs.pmnd.rs/) |
| Toasts | [Sonner](https://sonner.emilkowal.dev/) |
| Icons | [Lucide React](https://lucide.dev/) |

### Production Build

```
dist/index.html             0.41 kB │ gzip:   0.28 kB
dist/assets/index-*.css    49.79 kB │ gzip:   8.85 kB
dist/assets/index-*.js    475.47 kB │ gzip: 145.63 kB
```

Build time: **~1 second**.

---

## Part of the Agent Platform

| Repo | Purpose | Status |
|---|---|---|
| [agent-core](https://github.com/bitop-dev/agent-core) | Standalone CLI + Go library | ✅ 171 tests, 45 commits |
| [agent-platform-api](https://github.com/bitop-dev/agent-platform-api) | Go Fiber REST API | ✅ 22 tests, 24 commits |
| **agent-platform-web** (this repo) | React web portal | ✅ 14 pages, 18 commits |
| [agent-platform-skills](https://github.com/bitop-dev/agent-platform-skills) | Community skill registry | ✅ 10 skills (4 WASM + 6 instruction) |
| [agent-platform-docs](https://github.com/bitop-dev/agent-platform-docs) | Architecture & planning | ✅ Comprehensive |

---

## License

MIT
