"""Streaming agent runner.

Bridges the *synchronous, blocking* LangGraph agent (`agent/graph.py`) to an
async WebSocket. The agent runs in a worker thread (so it never blocks the event
loop), and emits events back through an asyncio.Queue:

    {"type": "status",   "node": "planner"}          # a graph node ran
    {"type": "file",     "path": "...", "content": ...}  # a file was written
    {"type": "complete"}                              # generation finished
    {"type": "error",    "message": "..."}            # generation failed

Each run is isolated to  <workspaces_dir>/<user_id>/<project_id>/  on disk.
"""
import asyncio
import pathlib
from collections.abc import AsyncIterator

from backend.config import get_settings


def workspace_dir(user_id: str, project_id: str) -> pathlib.Path:
    base = pathlib.Path(get_settings().workspaces_dir).resolve()
    # user_id / project_id come from a verified JWT + our own DB (UUIDs), but
    # guard against traversal regardless.
    safe_user = pathlib.Path(user_id).name
    safe_proj = pathlib.Path(project_id).name
    return base / safe_user / safe_proj


async def stream_generation(
    *, user_id: str, project_id: str, prompt: str, recursion_limit: int = 100
) -> AsyncIterator[dict]:
    """Yield generation events as they happen. Caller persists/forwards them."""
    root = workspace_dir(user_id, project_id)
    root.mkdir(parents=True, exist_ok=True)

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    _DONE = object()

    def emit(event: dict) -> None:
        # Called from the worker thread -> hop back to the loop thread safely.
        loop.call_soon_threadsafe(queue.put_nowait, event)

    def on_write(path: str, content: str) -> None:
        emit({"type": "file", "path": path, "content": content})

    def run_blocking() -> None:
        # Imported lazily: importing graph.py constructs the Groq client, which
        # we don't want at module-import time (keeps the app importable w/o a key).
        from agent.graph import agent
        from agent.tools import set_run_context

        set_run_context(root, on_write)
        try:
            for chunk in agent.stream(
                {"user_prompt": prompt},
                {"recursion_limit": recursion_limit},
                stream_mode="updates",
            ):
                for node_name in chunk.keys():
                    emit({"type": "status", "node": node_name})
            print("--- [generate_project] COMPLETE ---")
            emit({"type": "complete"})
        except Exception as exc:
            print(f"--- [generate_project] ERROR: {exc} ---")  # noqa: BLE001 - surface to client as an event
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
