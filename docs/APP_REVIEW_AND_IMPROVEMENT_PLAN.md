# App Review & Improvement Plan

> Snapshot date: 2026-08-22. This reviews the app **as it exists in the repo today**
> (not the aspirational architecture in `BUILD_PLAN.md`) and lists concrete,
> actionable changes. Treat `BUILD_PLAN.md` / `PREVIEW_OPTIONS.md` as the long-term
> vision doc; this file is the **"what's actually broken/missing right now"** doc.

---

## 1. What the app is today

A Lovable/bolt.new-style AI website builder:

- **`agent/`** — LangGraph graph: `Planner → Architect → Coder` using Groq
  (`llama-3.3-70b-versatile`). Coder writes vanilla HTML/CSS/JS files only.
- **`backend/`** — FastAPI service (`/api/ai/...`) with JWT auth (trusts tokens
  issued by an external Spring Boot app), project/file/message CRUD backed by
  SQLAlchemy (SQLite locally, Postgres in prod), and a WebSocket endpoint that
  streams generation events and persists files as they're written.
- **`frontend/`** — Next.js 15 dashboard + a 3-panel workspace (Chat / Monaco
  editor / live `<iframe srcdoc>` preview), with ZIP export, device-size preview,
  and an in-browser console that captures `console.*`/`window.onerror` from the
  preview iframe.

**This matches "Option A" (iframe `srcdoc`) from `PREVIEW_OPTIONS.md` and Phase
0–2 (partially 3/4) of `BUILD_PLAN.md`.** The core loop (prompt → generate →
preview → edit) works end-to-end for first-time generation of static HTML/CSS/JS
apps.

---

## 2. What already works well (don't break these)

- Clean separation of `agent/` (pure LangGraph, reusable by CLI or server) from
  `backend/` (FastAPI wrapper) — `agent_runner.py` bridges the blocking agent
  into an async WebSocket cleanly via a thread + `asyncio.Queue`.
- Per-user/per-project workspace isolation on disk (`workspaces/<user>/<project>/`)
  with path-traversal guards in `agent/tools.py` (`safe_path_for_project`).
  Ownership checks on every project/file/message query (`backend/api/projects.py`).
  `_owned_project` intentionally 404s instead of 403 to avoid leaking existence.
- Frontend gracefully degrades to `localStorage` + a simulated generator when
  the backend is unreachable — good for demos/offline dev.
- ZIP export (`Header.tsx`, using `jszip`/`file-saver`) is already implemented.
- Preview iframe already pipes `console.log/error/warn` and `window.onerror`
  back to the parent via `postMessage`, shown in a dev-console drawer — a nice,
  underused feature.

---

## 3. Issues found (ordered by impact)

### 🔴 Critical

1. **`.gitignore` is corrupted (wrong encoding) and is NOT working.**
   The file contains null/UTF-16 artifacts after the "System files" section.
   `git status` confirms `wb_dev.db`, `workspaces/`, `frontend/node_modules/`,
   and `frontend/.next/` all show as untracked (`??`) instead of ignored — one
   `git add .` away from committing the SQLite DB, all generated user
   workspaces, and node_modules into the repo.
   → **Fix immediately**, see Action Plan §4.1.

2. **"Edit mode" doesn't exist — every chat message regenerates from scratch.**
   `planner_agent` (`agent/graph.py`) only ever looks at `state["user_prompt"]`.
   It has no knowledge of the project's existing files/plan. So a follow-up like
   "make it dark mode" makes the Architect invent a brand-new file plan, and the
   Coder overwrites everything based on that new plan — it does NOT make a
   targeted edit to the existing app. `BUILD_PLAN.md` Phase 5 already flags this
   as unbuilt, but it's the single biggest gap between "impressive demo" and
   "usable product," since conversational iteration is the core promise of a
   Lovable-style tool.

3. **Parallel coder execution defeats the Architect's dependency ordering.**
   `coder_agent` fires **every** remaining implementation step into a
   `ThreadPoolExecutor(max_workers=3)` simultaneously. But the Architect's own
   prompt explicitly says *"Order tasks so dependencies are implemented first"*
   and *"carry forward context from earlier tasks."* Since tasks run
   concurrently, a task for `script.js` that depends on `index.html` existing
   may run before `index.html` is written — `read_file` returns empty content,
   so the coder loses the cross-file context it needs. This is a correctness
   bug, not just a performance nitpick.

### 🟠 High

4. **Plan Mode is a non-functional UI stub.** `ChatPanel` has a fully built
   Auto/Plan toggle and a "Plan Review Required" approval UI, and `types.ts`
   defines a `"plan"` `GenerationEvent`. But `handleSendMessage`
   (`app/project/[id]/page.tsx`) never reads `builderMode` before calling
   `streamProjectGeneration`, and the backend never emits a `plan` event or
   pauses (no `interrupt_before`, no checkpointer, despite `BUILD_PLAN.md` §5.5
   already speccing this out in detail). Toggling to "Plan" currently does
   nothing different from "Auto" — this will confuse/mislead users.

5. **Partial generation failures are silently swallowed.** In
   `_process_task` (`agent/graph.py`), if a file fails after 3 retries it logs
   an error and returns `False` — but `coder_agent`'s `as_completed` loop only
   catches *unhandled exceptions*, never checks the boolean result. The
   WebSocket handler then still sends `{"type": "complete"}` and the frontend
   fires confetti and says "built successfully" even if some files never got
   written.

6. **`set_debug(True)` is hardcoded in `agent/graph.py`.** This was already
   called out as a to-do in `BUILD_PLAN.md` Phase 0 ("turn off `set_debug`") but
   is still `_DEBUG = True` today — every request dumps full LangChain internals
   to stdout, hurting both performance and log readability/cost in a JSON-log
   production setup (`backend/logging_config.py` was clearly built for
   structured prod logging, but this floods it with debug noise).

7. **Stale `local-*` project IDs can leak into backend calls.** If
   `fetchProjects`/`createProject` falls back to `localStorage` (backend
   unreachable) and later the backend comes back up, the workspace page still
   calls `fetchProject(id)`, `streamProjectGeneration(id, ...)` etc. with a
   `local-<timestamp>-<rand>` id — the backend will reject it (not a valid
   UUID) and the user is stuck in a half-broken state with no clear message
   explaining why. There's also no visible "offline/demo mode" indicator, so a
   user can't tell simulated content from a real AI generation.
   → **Resolved.** `isLocalProjectId` short-circuits every API call for
   `local-*`/`demo-*` ids, and the workspace header shows an amber "Offline
   demo" badge. The *second* half — a real project silently falling back to
   canned content when the WebSocket fails — now emits a `simulated` event, so
   the header badge lights up, confetti is suppressed, and the chat says the
   files are sample content rather than an AI build.

8. **Hardcoded single `dev-token`, no real auth wiring.** `frontend/src/lib/api.ts`
   sends `Authorization: Bearer dev-token` unconditionally. That's fine for the
   "AI service is embedded behind an existing Spring Boot app" design mentioned
   in `backend/security/auth.py`, but nothing in this repo currently documents
   or implements *how* a real token gets from that host app into the Next.js
   frontend. If this frontend is meant to be used standalone (as the README
   suggests), there is no login/signup flow at all.
   → **Resolved.** `frontend/src/lib/auth.ts` implements the handoff: a
   `?token=<jwt>` query param (persisted, then stripped from the URL so it never
   reaches history or access logs), then `localStorage["wb_auth_token"]`, then a
   `NEXT_PUBLIC_DEV_AUTH_TOKEN` dev fallback. Documented under "Authentication"
   in the README. No login flow was added on purpose — that would create a
   second identity source alongside the host app.

### 🟡 Medium

9. **No automated tests anywhere** (no `tests/` folder, no CI config). Given
   the correctness-sensitive pieces (JWT verification, path-traversal guard in
   `safe_path_for_project`, project ownership checks), these are exactly the
   kind of logic that should have unit tests before the next refactor.

10. **`run_cmd` tool in `agent/tools.py` executes arbitrary shell strings**
    (`subprocess.run(cmd, shell=True, ...)`). It's currently unused (not in the
    coder's tool list), but it's dead, dangerous code sitting in the same file
    as sanctioned tools — an easy trap for a future "let's give the agent more
    power" change. Either delete it or gate it behind an explicit allowlist +
    feature flag before it's ever wired up.

11. **No per-user rate limiting / generation quotas.** Every WebSocket
    connection kicks off a real Groq call tree (Planner → Architect → N
    parallel Coder calls). Nothing stops a user from spamming generations,
    which is a real cost/abuse risk once this is exposed beyond localhost.

12. **README is stale.** `README.md` still documents the original CLI-only
    "Coder Buddy" (`python main.py`) flow and doesn't mention the FastAPI
    backend, the Next.js frontend, `.env` vs `.env.example`, or how to run the
    full stack. Anyone cloning fresh has to reverse-engineer the two `.env`
    files and two run commands from source.

13. **Root directory clutter.** `generated_project/`, `pre_generated_project_calculator/`,
    `pre_generated_project_todo_app/`, and `workspaces/` sit at the repo root
    from ad-hoc CLI runs / testing. Combined with issue #1, some of this is at
    risk of being committed. These should either move under a single
    `.local/` (gitignored) directory or be deleted if no longer needed.

14. **`GenerationEvent` streams whole-file content only, not tokens.** This is
    consistent with the current design (fine for an MVP), but note it so
    `BUILD_PLAN.md` Phase 4 ("stream file contents token-by-token") isn't
    mistaken for already-done — right now the UI just gets one big `file` event
    per completed file.

### 🟢 Low / polish

15. Frontend uses `alert()`/`confirm()` browser dialogs for delete confirmation
    (`page.tsx`) — inconsistent with the otherwise polished custom-modal UI
    elsewhere; swap for the existing modal pattern.
    → **Resolved.** Delete now goes through a `pendingDeleteId` custom modal
    matching the "Create New Project" dialog.
16. `agent/prompts.py` locks the Coder to *only* vanilla HTML/CSS/JS. That's a
    deliberate, sensible MVP constraint (matches `PREVIEW_OPTIONS.md`'s "Option
    A" decision) — just flagging so nobody "fixes" the Planner prompt to allow
    React without also solving the preview-runtime story first.
17. No favicon/OG metadata customization in `frontend/src/app/layout.tsx`
    (not checked in depth, but worth a pass before any public launch).
    → **Resolved.** Added `src/app/icon.svg` (auto-served as the favicon) plus
    `metadataBase`, a title template, Open Graph and Twitter card tags, and a
    `viewport` export with `themeColor`. Set `NEXT_PUBLIC_SITE_URL` in prod so
    OG URLs aren't `localhost`.
18. `backend/config.py`'s dev JWT bypass (`dev-token`/`dev`/`mock-token`/etc.)
    is safely gated behind `app_env == "dev"`, but double-check this can never
    be reached with `APP_ENV=prod` misconfigured to something else like
    `"development"` (it's a `Literal["dev","staging","prod"]`, so pydantic
    would already reject a typo — good, just confirming it during any future
    settings refactor).

---

## 4. Action Plan

### 4.1 Do right now (minutes, zero risk)

- [x] **Rewrite `.gitignore`** in plain UTF-8 (no BOM/UTF-16) and verify with
      `git check-ignore -v wb_dev.db workspaces frontend/node_modules frontend/.next`
      that all four now report as ignored.
- [x] If `wb_dev.db`, `workspaces/`, `frontend/node_modules/`, `frontend/.next/`
      were ever previously committed, remove them from tracking
      (`git rm -r --cached ...`) after the `.gitignore` fix. (`generated_project/`
      was tracked and has been untracked; the four scratch paths were never committed.)
- [x] Turn off `set_debug(True)` / `set_verbose(True)` in `agent/graph.py`
      (drive it from `Settings.app_env` or an explicit `AGENT_DEBUG` env var
      instead of a hardcoded `True`).
- [x] Delete or explicitly quarantine the unused `run_cmd` tool in
      `agent/tools.py`.

### 4.2 Next (small, self-contained changes)

- [x] **Surface partial-failure state**: have `coder_agent` collect
      `_process_task` results, and if any file failed, emit
      `{"type":"error", "message": "...", "partial": true}` (or a new
      `"partial_failure"` event type) instead of a silent `complete`. Update the
      frontend to show a clear warning instead of confetti when that happens.
- [x] **Serialize dependent coder tasks / cap true parallelism to independent
      files**: either (a) run tasks sequentially per the Architect's ordering
      (simplest, safest), or (b) have the Architect tag each task with the
      files it depends on and only parallelize tasks with no unmet
      dependencies. Given the current file count is small (3–6 files), (a) is
      the pragmatic fix — parallelism isn't buying much and is actively harmful
      to correctness today.
- [x] **Fix the offline/local-project mismatch**: tag locally-created projects
      distinctly (e.g. `isLocal: true` in the cached object) and show a visible
      "Offline demo — connect the backend to save for real" banner in the
      workspace instead of silently attempting (and failing) real API calls
      with a non-UUID id.
- [x] **Wire up or remove Plan Mode.** Either:
  - remove the Auto/Plan toggle and "Plan Review Required" UI until it's
    real, or
  - implement the interrupt flow already spec'd in `BUILD_PLAN.md` §5.5
    (checkpointer + `interrupt_before=["coder"]`, resume with the same
    `thread_id`). This is a well-scoped, self-contained feature — good
    candidate for the next feature slot.
- [x] Update `README.md` to describe the actual current run steps: two `.env`
      files (root `.env` for the agent/backend, none needed for frontend unless
      overriding `NEXT_PUBLIC_API_BASE`/`NEXT_PUBLIC_WS_BASE`), `uv run uvicorn
      backend.main:app --reload --port 8001` for the backend, `npm run dev` in
      `frontend/` for the UI, and `python main.py` only for the old CLI path.
- [x] Clean up root-level `generated_project/`, `pre_generated_project_*`,
      `workspaces/` — move under one gitignored scratch directory (e.g.
      `.local/`) or delete if stale. (`generated_project/` and `workspaces/`
      are gitignored; sample `pre_generated_project_*` folders were left in
      place as reference apps.)

### 4.3 Next milestone (the actual product gap)

- [x] **Real edit mode** (the highest-value change): when a project already has
      files, the Planner/Architect should receive the existing file tree +
      contents (or a summary of them) as context, and produce a **diff-style**
      task list — "modify these N files, add these M files" — instead of a
      from-scratch plan. This directly closes the gap called out in
      `BUILD_PLAN.md` Phase 5 and is what makes the chat loop feel like Lovable
      instead of "regenerate app with new theme every time."
- [x] Add minimal automated tests: JWT decode (valid/expired/wrong-alg),
      `safe_path_for_project` traversal rejection, project ownership 404s,
      and a smoke test that `agent.invoke(...)` produces a plan for a trivial
      prompt (can be skipped/mocked in CI without a real Groq key).
- [x] Add basic per-user/per-IP rate limiting on the `/generate` WebSocket
      (even a simple in-memory token bucket keyed by user id is enough for now).

### 4.4 Polish (issues 7b, 8, 15, 17)

- [x] Replace `alert()`/`confirm()` delete confirmation with the existing custom
      modal pattern.
- [x] Implement the auth-token handoff (`frontend/src/lib/auth.ts`) so a real
      host-app JWT can reach the frontend, and document it in the README.
- [x] Label the WebSocket-failure fallback: emit a `simulated` event so canned
      demo files are never presented as a real AI generation (no confetti, amber
      header badge, explicit chat message).
- [x] Add favicon (`src/app/icon.svg`) + Open Graph / Twitter / theme-color
      metadata.
- [x] Delete the dead, broken `list_file` alias in `agent/tools.py` — it called
      the `list_files` **tool object** directly, so it would have raised if ever
      wired up. Same class of trap as the `run_cmd` tool in issue #10.
- [x] Ignore `*.tsbuildinfo` (TypeScript build artifact, issue #1 hygiene).

### 4.5 Later / already tracked in `BUILD_PLAN.md`

These are bigger, already-documented in the existing plan docs — listed here
just so this review doesn't duplicate them. **They are intentionally still
open**; none of them is started:

- Token-by-token file streaming (Phase 4).
- WebContainers-based live preview for non-static-HTML stacks (Phase 3,
  `PREVIEW_OPTIONS.md` Option C) — only needed if/when the Planner is ever
  allowed to target React/Vite.
- Self-healing (feed preview console errors back into the agent) (Phase 5).
- Deploy/publish, billing, templates library (Phase 6).

---

## 5. Status — 2026-09-19

Everything in §4.1–§4.4 is implemented. Verified on this date:

- `uv run pytest` → 16 passed, 1 skipped (the planner smoke test, which needs a
  real `GROQ_API_KEY`).
- `npx tsc --noEmit` → clean. `npm run build` → clean, 5 routes.
- Favicon and OG/Twitter/theme-color tags confirmed in the served HTML against a
  running dev server.

**Not verified by clicking through the UI**: the `?token=` auth handoff and the
offline-fallback banner are client-side paths that need a browser session (and,
for a real generation, a Groq key). Both typecheck and build, but exercise them
manually before relying on them.

Everything in §4.5 remains open by design — those are `BUILD_PLAN.md` phases,
not review findings. The next highest-value one is **token-by-token streaming**
(Phase 4): the agent currently emits one `file` event per completed file, so the
UI has no progress signal during the slowest part of a generation.
