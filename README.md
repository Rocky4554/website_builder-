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

## Example prompts

- Create a to-do list application using HTML, CSS, and JavaScript.
- Create a simple calculator web application.
- Add a dark mode toggle and persist it in localStorage.

---
Copyright © Codebasics Inc. All rights reserved.
