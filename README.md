# Website Builder (Coder Buddy)

AI website builder: type a prompt, watch a multi-agent team (`Planner → Architect → Coder`) generate a vanilla HTML/CSS/JS app, then preview and edit it in the browser.

## Architecture

| Layer | Stack | Role |
|-------|--------|------|
| Agent | LangGraph + Groq | Plans, designs file tasks, writes code |
| Backend | FastAPI | JWT auth, project CRUD, WebSocket generation stream |
| Frontend | Next.js 15 + Tailwind + Monaco | Dashboard, chat, editor, live iframe preview |
| Data | SQLite (local) or Postgres | Projects, files, chat messages |

## Prerequisites

- Python 3.11+ and [uv](https://docs.astral.sh/uv/getting-started/installation/)
- Node.js 18+
- A [Groq API key](https://console.groq.com/keys)

## Setup

1. Create and activate a virtual environment:

   ```bash
   uv venv
   # Windows PowerShell
   .venv\Scripts\Activate.ps1
   # macOS / Linux
   source .venv/bin/activate
   ```

2. Install Python dependencies:

   ```bash
   uv sync
   ```

3. Copy environment variables and fill in at least `GROQ_API_KEY`:

   ```bash
   cp .env.example .env
   ```

   Local defaults already use SQLite (`wb_dev.db`) and a `dev-token` JWT bypass when `APP_ENV=dev`. You do **not** need a real Spring Boot JWT for local use.

4. Install the frontend:

   ```bash
   cd frontend
   npm install
   cd ..
   ```

## Run the full stack

Terminal 1 — FastAPI backend (port 8001):

```bash
uv run uvicorn backend.main:app --reload --port 8001
```

Terminal 2 — Next.js UI (port 3000):

```bash
cd frontend
npm run dev
```

Open http://localhost:3000

The frontend talks to `http://localhost:8001/api/ai` and `ws://localhost:8001/api/ai` by default. Override with `NEXT_PUBLIC_API_BASE` / `NEXT_PUBLIC_WS_BASE` if needed.

## Authentication

This service **verifies** JWTs but never issues them — the host Spring Boot app is the
single source of truth for identity. The backend checks the signature with
`JWT_SECRET` (HS*) or `JWT_PUBLIC_KEY` (RS256) and reads the user id from the
`JWT_USER_ID_CLAIM` claim (`userId` by default).

**Local development:** with `APP_ENV=dev` the backend accepts the literal string
`dev-token`, which is what the frontend sends when nothing else is configured. No
real JWT needed.

**Real deployment:** the token reaches the browser one of three ways, checked in
this order by `frontend/src/lib/auth.ts`:

1. `?token=<jwt>` on any URL — the host app redirects here with the token
   appended. It is persisted and stripped from the address bar immediately, so it
   never lands in browser history or server access logs.
2. `localStorage["wb_auth_token"]` — persisted from a previous handoff, or set by
   a host page that embeds this UI (`setAuthToken(jwt)`).
3. `NEXT_PUBLIC_DEV_AUTH_TOKEN` — development fallback only (defaults to
   `dev-token`).

There is deliberately **no login/signup flow in this repo**; adding one would
create a second identity source.

## Optional: CLI-only agent

The original one-shot CLI still works. It writes into `generated_project/` (gitignored):

```bash
uv run python main.py
```

## Tests

```bash
uv sync
uv run pytest
```

The planner smoke test is skipped unless `GROQ_API_KEY` is set.

## How a generation works

1. Create or open a project in the dashboard.
2. Send a prompt in the chat (or use a starter template).
3. **Auto mode** — Planner → Architect → Coder run in one shot.
4. **Plan mode** — the graph pauses after the Architect; approve or cancel before any files are written.
5. Follow-up messages use **edit mode**: existing files are loaded as context so the agents make targeted changes instead of regenerating the whole app.
6. Files stream into Monaco and the preview iframe as they are written. Export ZIP from the workspace header.

Generations are rate limited to 5 per 5 minutes per user.

If the backend is unreachable the UI falls back to **offline demo mode**: projects
live in `localStorage` and generations return canned sample files. This is clearly
labelled — an amber "Offline demo" badge appears in the workspace header and the
chat says the files are sample content, not a real AI build.

## Example prompts

- Create a to-do list application using HTML, CSS, and JavaScript.
- Create a simple calculator web application.
- Add a dark mode toggle and persist it in localStorage.

---
Copyright © Codebasics Inc. All rights reserved.
