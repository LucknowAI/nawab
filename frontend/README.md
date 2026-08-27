# Nawab AI — frontend

Next.js frontend for Nawab AI — chat UI, Google Sign-In / OTP auth, city selector. Talks to the [backend](../backend) over REST + WebSocket.

## Prerequisites

- Node.js 22+ (see `.nvmrc`; `package.json` enforces `>=22`)
- The [backend](../backend) running locally (default `http://localhost:9000`)

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | URL of the running backend, e.g. `http://localhost:9000` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID — must match the backend's `GOOGLE_CLIENT_ID` |

## Run

```bash
npm run dev
```

App runs at [http://localhost:9001](http://localhost:9001).

Make sure the backend's `FRONTEND_ORIGINS` includes `http://localhost:9001`, or Google Sign-In / API calls will be blocked by CORS.

## Build

```bash
npm run build
npm start
```

`npm start` also serves on [http://localhost:9001](http://localhost:9001).

## Lint & test

```bash
npm run lint
npm test        # vitest, jsdom + react-testing-library
```

Both run on every PR — see [CI](#ci) below.

## Architecture

```
browser ──► Next.js App Router ──► app/api/* proxy routes ──► backend
                    │                                              │
                    └──────────── WebSocket ───────────────────────┘
                             /api/v1/chat/ws
```

- **Proxy routes.** Everything under `app/api/` is a thin server-side proxy to the
  backend. They exist so the browser never holds the backend origin directly and so
  auth cookies stay HTTP-only. All of them import the base URL from
  `app/lib/backend.ts` — the single source of truth.
- **Chat transport is a WebSocket**, not the REST routes. `app/hooks/useNawabWS.ts`
  opens `/api/v1/chat/ws`, authenticates with a short-lived token from
  `/api/ws-token`, and reconnects up to 3 times with backoff.
- **Event stream → UI.** The backend emits typed events (`text_delta`, `tool_call`,
  `tool_result`, `question`, `run_done`, `error`). The hook reduces them into a
  `DisplayItem` union (`user` | `text` | `tool`), which `NawabChat` renders. Text
  deltas are buffered through a character-level typewriter so irregular token
  chunks animate smoothly.
- **Tool calls become UI, not text.** `NawabActionsProvider.renderToolCall()` maps
  each tool name to a card component (places, news, videos, maps, images, facts,
  metro routes, sources) and renders a skeleton while arguments are still streaming.
- **History replay.** `/api/conversations/[threadId]/replay` returns stored
  snapshots, which the hook reconstructs back into the same `DisplayItem` list — so
  a reloaded thread looks identical to a live one.
- **Theming is CSS-driven.** `data-city` on the root element swaps a set of CSS
  custom properties (`--city-color`, `--nawab-gold`, …) defined in `app/globals.css`.
  Components read the variables; there is no JS colour map.

## Folder structure

| Path | What lives there |
|---|---|
| `app/api/` | Server-side proxy routes to the backend (auth, conversations, feedback, health, ws-token) |
| `app/components/` | Feature components (chat, sidebar, city selector, mascot, cards) |
| `app/components/ui/` | Shared presentational primitives — see [DESIGN.md](DESIGN.md) |
| `app/context/` | React contexts: `AuthContext`, `BackendStatusContext` |
| `app/hooks/` | `useNawabWS` (chat transport), `useAutosize` |
| `app/lib/` | Non-React helpers: `backend.ts`, `motion.ts`, `anime-utils.ts` |
| `app/globals.css` | Design tokens, per-city themes, and all component styling |
| `app/login/`, `app/feedback/`, `app/about/` | Route pages |

## CI

[.github/workflows/ci.yml](../.github/workflows/ci.yml) runs on every PR and on pushes
to `main` / `dev` that touch `frontend/`: **lint** → **test** → **build** (build waits
on the other two). All three must pass before merge.

Deployment is *not* handled by GitHub Actions — see [Docker](#docker); the image is
built and pushed by Google Cloud Build (`cloudbuild.yaml`) and served on Cloud Run.

## Docker

`NEXT_PUBLIC_*` vars are inlined at build time, so pass them as build args:

```bash
docker build \
  --build-arg NEXT_PUBLIC_BACKEND_URL=http://localhost:9000 \
  --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-client-id> \
  -t nawab-frontend .
docker run -p 8080:8080 nawab-frontend
```

## More docs

| Doc | What it covers |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Code style, tests |
| [DESIGN.md](DESIGN.md) | "The Gilded Diwan" design system — tokens, type, elevation, components |
| [PRODUCT.md](PRODUCT.md) | Product brief: audience, purpose, brand personality, principles |
| [docs/](docs/) | Feature specs and implementation plans |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Repo-wide branching, PRs, CI |
| [../CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | Contributor conduct expectations |
| [../SECURITY.md](../SECURITY.md) | How to report a vulnerability |
