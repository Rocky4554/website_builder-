"""Streaming agent runner.

Bridges the *synchronous, blocking* LangGraph agent (`agent/graph.py`) to an
async WebSocket. The agent runs in a worker thread (so it never blocks the event
loop), and emits events back through an asyncio.Queue:

    {"type": "status",   "node": "planner"}
    {"type": "plan",     "plan": {...}}
    {"type": "awaiting_approval", "plan": {...}}
    {"type": "file",     "path": "...", "content": ...}
    {"type": "complete"}
    {"type": "error",    "message": "...", "partial": bool}

Each run is isolated to  <workspaces_dir>/<user_id>/<project_id>/  on disk.
"""
from __future__ import annotations

import asyncio
import logging
import pathlib
import uuid
from collections.abc import AsyncIterator

from backend.config import get_settings

logger = logging.getLogger("backend.agent_runner")

_MAX_FILE_CHARS = 50_000


def workspace_dir(user_id: str, project_id: str) -> pathlib.Path:
    base = pathlib.Path(get_settings().workspaces_dir).resolve()
    # user_id / project_id come from a verified JWT + our own DB (UUIDs), but
    # guard against traversal regardless.
    safe_user = pathlib.Path(user_id).name
    safe_proj = pathlib.Path(project_id).name
    return base / safe_user / safe_proj


def hydrate_workspace(root: pathlib.Path, files: dict[str, str]) -> None:
    """Write DB files onto disk so the coder can read them during edits."""
    for rel, content in (files or {}).items():
        safe = pathlib.Path(rel)
        if safe.is_absolute() or ".." in safe.parts:
            continue
        dest = (root / safe).resolve()
        try:
            dest.relative_to(root.resolve())
        except ValueError:
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.exists():
            dest.write_text(content or "", encoding="utf-8")


def load_workspace_files(root: pathlib.Path) -> dict[str, str]:
    files: dict[str, str] = {}
    if not root.exists():
        return files
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        rel = str(path.relative_to(root)).replace("\\", "/")
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        files[rel] = text[:_MAX_FILE_CHARS]
    return files


def _dump_plan(update: dict) -> dict | None:
    from agent.graph import _serialize_plan

    if not isinstance(update, dict):
        return None
    if "plan" in update or "task_plan" in update:
        return _serialize_plan(update)
    return None


def _extract_interrupt_payload(snapshot) -> dict | None:
    interrupts = getattr(snapshot, "interrupts", None)
    if not interrupts:
        return None
    first = interrupts[0]
    value = getattr(first, "value", first)
    return value if isinstance(value, dict) else None


async def stream_generation(
    *,
    user_id: str,
    project_id: str,
    prompt: str,
    mode: str = "auto",
    existing_files: dict[str, str] | None = None,
    approval_queue: asyncio.Queue | None = None,
    recursion_limit: int = 100,
) -> AsyncIterator[dict]:
    """Yield generation events as they happen. Caller persists/forwards them."""
    root = workspace_dir(user_id, project_id)
    root.mkdir(parents=True, exist_ok=True)
    if existing_files:
        hydrate_workspace(root, existing_files)

    disk_files = load_workspace_files(root)
    merged_files = {**(existing_files or {}), **disk_files}

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    _DONE = object()
    mode = (mode or "auto").lower()
    if mode not in {"auto", "plan"}:
        mode = "auto"

    def emit(event: dict) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, event)

    def on_write(path: str, content: str) -> None:
        emit({"type": "file", "path": path, "content": content})

    def wait_for_decision() -> dict:
        if approval_queue is None:
            return {"action": "approve"}
        future = asyncio.run_coroutine_threadsafe(approval_queue.get(), loop)
        try:
            decision = future.result(timeout=300)
        except Exception:
            return {"action": "reject"}
        if isinstance(decision, dict):
            return decision
        return {"action": str(decision)}

    def run_stream(stream, last_plan: dict | None) -> tuple[str | None, dict | None, list[str]]:
        """Consume an agent.stream iterator. Returns (terminal_status, last_plan, failed_files)."""
        terminal = None
        failed: list[str] = []
        for chunk in stream:
            if not isinstance(chunk, dict):
                continue
            for node_name, update in chunk.items():
                if node_name.startswith("__"):
                    continue
                emit({"type": "status", "node": node_name})
                dumped = _dump_plan(update) if isinstance(update, dict) else None
                if dumped:
                    last_plan = dumped
                    emit({"type": "plan", "plan": dumped})
                if isinstance(update, dict) and node_name == "coder":
                    terminal = update.get("status") or terminal
                    failed = list(update.get("failed_files") or failed)
        return terminal, last_plan, failed

    def run_blocking() -> None:
        from langgraph.types import Command

        from agent.graph import agent
        from agent.tools import set_run_context

        set_run_context(root, on_write)
        config = {
            "recursion_limit": recursion_limit,
            "configurable": {"thread_id": f"{project_id}:{uuid.uuid4()}"},
        }
        inputs = {
            "user_prompt": prompt,
            "mode": mode,
            "existing_files": merged_files,
        }
        logger.info(
            f"Starting generation for project {project_id} mode={mode} existing={len(merged_files)}",
            extra={"project_id": project_id},
        )
        try:
            terminal, last_plan, failed = run_stream(
                agent.stream(inputs, config, stream_mode="updates"),
                None,
            )
            snapshot = agent.get_state(config)
            paused = bool(getattr(snapshot, "next", ()))
            if paused and mode == "plan":
                payload = _extract_interrupt_payload(snapshot) or {}
                plan = payload.get("plan") or last_plan or {}
                emit({"type": "plan", "plan": plan})
                emit({"type": "awaiting_approval", "plan": plan})
                decision = wait_for_decision()
                action = str((decision or {}).get("action") or "reject").lower()
                if action in {"reject", "cancel"}:
                    emit({"type": "cancelled", "message": "Plan rejected by user"})
                    return
                terminal, last_plan, failed = run_stream(
                    agent.stream(Command(resume=decision), config, stream_mode="updates"),
                    last_plan,
                )

            if terminal == "PARTIAL":
                logger.error(
                    f"Generation PARTIAL: {failed}",
                    extra={"project_id": project_id},
                )
                emit({
                    "type": "error",
                    "message": "Some files failed to generate: " + ", ".join(failed or ["unknown"]),
                    "partial": True,
                })
            elif terminal == "CANCELLED":
                emit({"type": "cancelled", "message": "Plan rejected by user"})
            else:
                logger.info("Generation COMPLETE", extra={"project_id": project_id})
                emit({"type": "complete"})
        except Exception as exc:
            logger.error(f"Generation ERROR: {exc}", extra={"project_id": project_id, "exc_info": True})
            emit({"type": "error", "message": str(exc)})
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, _DONE)

    task = asyncio.create_task(asyncio.to_thread(run_blocking))
    try:
        while True:
            event = await queue.get()
            if event is _DONE:
                break
            yield event
    finally:
        await task
