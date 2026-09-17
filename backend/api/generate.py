"""WebSocket generation endpoint.

    ws  <api_prefix>/projects/{project_id}/generate

Protocol:
  1. Client connects, then sends ONE json message:
        {"token": "<jwt>", "prompt": "...", "mode": "auto"|"plan"}
     (Browsers can't set Authorization headers on WebSockets, so we authenticate
      via the first message instead of a query string — keeps the token out of
      access logs / URLs.)
  2. Server verifies the JWT, checks the user owns the project, then streams:
        {"type":"status","node":"planner"}
        {"type":"plan","plan":{...}}
        {"type":"awaiting_approval","plan":{...}}   # plan mode only
        {"type":"file","path":"index.html","content":"..."}
        {"type":"complete"} | {"type":"error","message":"...","partial":bool}
        | {"type":"cancelled"}
  3. In plan mode, after awaiting_approval the client sends:
        {"action":"approve"} | {"action":"reject"}
"""
import asyncio
import uuid

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from backend.config import get_settings
from backend.db.database import get_sessionmaker
from backend.db.models import Message, Project, ProjectFile
from backend.security.auth import decode_token
from backend.security.rate_limit import generation_limiter
from backend.services.agent_runner import stream_generation

router = APIRouter()

# Close codes
_POLICY_VIOLATION = 1008
_AUTH_TIMEOUT_SECONDS = 15
_APPROVAL_TIMEOUT_SECONDS = 300


@router.websocket("/projects/{project_id}/generate")
async def generate_ws(websocket: WebSocket, project_id: uuid.UUID) -> None:
    await websocket.accept()
    settings = get_settings()

    # --- 1. First-message auth ---
    try:
        first = await asyncio.wait_for(websocket.receive_json(), timeout=_AUTH_TIMEOUT_SECONDS)
    except (asyncio.TimeoutError, WebSocketDisconnect):
        await websocket.close(code=_POLICY_VIOLATION, reason="Auth message not received")
        return
    except Exception:
        await websocket.close(code=_POLICY_VIOLATION, reason="Malformed auth message")
        return

    token = (first or {}).get("token")
    prompt = ((first or {}).get("prompt") or "").strip()
    mode = str((first or {}).get("mode") or "auto").lower()
    if mode not in {"auto", "plan"}:
        mode = "auto"

    try:
        user = decode_token(token, settings)
        user_uuid = uuid.UUID(user.id)
    except HTTPException as exc:
        await websocket.close(code=_POLICY_VIOLATION, reason=str(exc.detail))
        return
    except (ValueError, TypeError):
        await websocket.close(code=_POLICY_VIOLATION, reason="Invalid user id in token")
        return

    if not prompt:
        await websocket.close(code=_POLICY_VIOLATION, reason="Empty prompt")
        return

    allowed, retry_after = generation_limiter.allow(str(user_uuid))
    if not allowed:
        await _safe_send(
            websocket,
            {
                "type": "error",
                "message": f"Rate limit exceeded. Try again in {retry_after}s.",
            },
        )
        await websocket.close(code=_POLICY_VIOLATION, reason="Rate limit exceeded")
        return

    sessionmaker = get_sessionmaker()

    # --- 2. Ownership check ---
    async with sessionmaker() as session:
        result = await session.execute(
            select(Project).where(Project.id == project_id, Project.user_id == user_uuid)
        )
        project = result.scalar_one_or_none()
        if project is None:
            await websocket.close(code=_POLICY_VIOLATION, reason="Project not found")
            return
        session.add(Message(project_id=project_id, role="user", content=prompt))
        await session.commit()

        file_rows = (
            await session.execute(select(ProjectFile).where(ProjectFile.project_id == project_id))
        ).scalars().all()
        existing_files = {row.path: row.content for row in file_rows}

    # --- 3. Stream generation, persisting files as they arrive ---
    files_written: list[str] = []
    terminal: dict | None = None
    approval_queue: asyncio.Queue = asyncio.Queue()
    wait_task: asyncio.Task | None = None

    async def _pump_approvals() -> None:
        """Read follow-up WS messages (approve/reject) while generation runs."""
        try:
            while True:
                msg = await websocket.receive_json()
                if isinstance(msg, dict) and msg.get("action"):
                    await approval_queue.put(msg)
        except Exception:
            await approval_queue.put({"action": "reject"})

    try:
        wait_task = asyncio.create_task(_pump_approvals())
        async for event in stream_generation(
            user_id=str(user_uuid),
            project_id=str(project_id),
            prompt=prompt,
            mode=mode,
            existing_files=existing_files,
            approval_queue=approval_queue,
        ):
            etype = event["type"]
            if etype == "file":
                await _upsert_file(sessionmaker, project_id, event["path"], event["content"])
                files_written.append(event["path"])
                await websocket.send_json(event)
            elif etype in ("complete", "error", "cancelled"):
                terminal = event
                break
            else:
                await websocket.send_json(event)
    except WebSocketDisconnect:
        await approval_queue.put({"action": "reject"})
        return
    except Exception as exc:  # noqa: BLE001
        terminal = {"type": "error", "message": str(exc)}
    finally:
        if wait_task is not None:
            wait_task.cancel()
            try:
                await wait_task
            except (asyncio.CancelledError, Exception):
                pass

    # --- 4. Save the assistant summary, THEN emit the terminal event ---
    if terminal is not None and terminal.get("type") == "error":
        prefix = "Partial generation: " if terminal.get("partial") else "Generation failed: "
        summary = prefix + str(terminal.get("message", "unknown error"))
    elif terminal is not None and terminal.get("type") == "cancelled":
        summary = "Build cancelled — plan was not approved."
    elif files_written:
        summary = f"Generated {len(files_written)} file(s): " + ", ".join(files_written)
    else:
        summary = "No files were generated."

    async with sessionmaker() as session:
        session.add(Message(project_id=project_id, role="assistant", content=summary))
        await session.commit()

    await _safe_send(websocket, terminal or {"type": "complete"})


async def _upsert_file(sessionmaker, project_id: uuid.UUID, path: str, content: str) -> None:
    async with sessionmaker() as session:
        result = await session.execute(
            select(ProjectFile).where(
                ProjectFile.project_id == project_id, ProjectFile.path == path
            )
        )
        existing = result.scalar_one_or_none()
        if existing is None:
            session.add(ProjectFile(project_id=project_id, path=path, content=content))
        else:
            existing.content = content
        await session.commit()


async def _safe_send(websocket: WebSocket, payload: dict) -> None:
    try:
        await websocket.send_json(payload)
    except Exception:  # noqa: BLE001 - socket may already be closed
        pass
