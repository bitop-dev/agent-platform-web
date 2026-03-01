# agent-platform-web

Web portal for the Agent Platform. Built with Bun + Vite + React + shadcn/ui + Tailwind CSS v4.

> **Status**: Phase 3 + Phase 4 skill sources complete — 45 source files, 11 pages, 6 commits. 122ms dev cold start, 1s production build.

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
| `/login` | Login | Email/password JWT authentication |
| `/register` | Register | New user registration |
| `/` | Dashboard | 4 stat cards + recent runs list |
| `/agents` | Agents | Card grid with create/delete |
| `/agents/new` | Create Agent | Name, description, system prompt, provider/model picker |
| `/agents/:id` | Agent Detail | Config display, quick-run input, run history |
| `/agents/:id/edit` | Edit Agent | Full form with enable/disable toggle |
| `/runs` | Runs | Table with mission, model, status, turns, duration |
| `/runs/:id` | Run Monitor | Live streaming output + event timeline + stop button |
| `/skills` | Skill Hub | Browse skills from all sources, add custom GitHub repos |
| `/settings/api-keys` | API Keys | Add/delete provider keys with base URL support |

---

## Architecture

```
src/
├── main.tsx              Entry point (BrowserRouter, QueryClient, Toaster)
├── App.tsx               Route definitions + ProtectedRoute wrapper
├── lib/
│   ├── api.ts            Typed API client (auth, agents, runs, skills, sources, keys)
│   ├── store.ts          Zustand auth store (login/register/logout/loadUser)
│   └── utils.ts          cn() helper
├── components/
│   ├── app-layout.tsx    Sidebar layout with nav + user info
│   └── ui/               14 shadcn/ui components
└── pages/
    ├── login.tsx
    ├── register.tsx
    ├── dashboard.tsx
    ├── agents.tsx
    ├── agents-new.tsx
    ├── agent-detail.tsx
    ├── agent-edit.tsx
    ├── runs.tsx
    ├── run-detail.tsx     Live streaming + event timeline
    ├── skills.tsx         Skill sources + skill browser
    └── api-keys.tsx
```

### Key Design Decisions

- **SPA with React Router** — no SSR needed, all data comes from the API
- **TanStack React Query** for server state — auto-caching, refetching, loading states
- **Zustand** for auth state — persists tokens in localStorage
- **Auto token refresh** — API client handles 401 → refresh → retry transparently
- **Dark theme only** — `class="dark"` on `<html>`, shadcn/ui new-york style

### Run Monitor Features

- **Live streaming output** via WebSocket (`/ws/runs/:id`)
- **Event timeline** with collapsed view:
  - Text deltas collapsed into single "Streaming output (N chunks)" row
  - Tool calls shown prominently with ⚡ start / ✓ end badges
  - Expandable args and output for each tool call
  - Turn boundaries shown as status rows
- **Stop button** — cancels running agents via `POST /runs/:id/cancel`
- **Auto-scroll** — output pane follows new content

### Skill Hub Features

- **Skill Sources** section — shows registered GitHub repos with sync status
- **Add Source** — point to any GitHub repo with `registry.json`
- **Sync All** — refresh skills from all sources
- **Skills grid** — browse with tier badges, tags, version, external source links

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

## Configuration

Create `.env` in the project root:

```
VITE_API_URL=http://localhost:8090
```

---

## Part of the Agent Platform

| Repo | Purpose | Status |
|---|---|---|
| [agent-core](https://github.com/bitop-dev/agent-core) | Standalone CLI + Go library | ✅ 111 tests, 26 commits |
| [agent-platform-api](https://github.com/bitop-dev/agent-platform-api) | Go Fiber REST API | ✅ 22 tests, 11 commits |
| **agent-platform-web** (this repo) | Bun + Vite + React web portal | ✅ 11 pages, 6 commits |
| [agent-platform-skills](https://github.com/bitop-dev/agent-platform-skills) | Community skill registry | ✅ 5 skills, 2 commits |
| [agent-platform-docs](https://github.com/bitop-dev/agent-platform-docs) | Architecture & planning | ✅ Comprehensive |

---

## License

MIT
