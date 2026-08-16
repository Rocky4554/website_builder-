"""WebSocket generation endpoint.

    ws  <api_prefix>/projects/{project_id}/generate

Protocol:
  1. Client connects, then sends ONE json message: {"token": "<jwt>", "prompt": "..."}
     (Browsers can't set Authorization headers on WebSockets, so we authenticate
      via the first message instead of a query string — keeps the token out of
      access logs / URLs.)
  2. Server verifies the JWT, checks the user owns the project, then streams:
        {"type":"status","node":"planner"}
        {"type":"file","path":"index.html","content":"..."}
        {"type":"complete"} | {"type":"error","message":"..."}
"""
import asyncio
import uuid

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from backend.config import get_settings
from backend.db.database import get_sessionmaker
from backend.db.models import Message, Project, ProjectFile
from backend.security.auth import decode_token
from backend.services.agent_runner import stream_generation

router = APIRouter()

# Close codes
_POLICY_VIOLATION = 1008
_AUTH_TIMEOUT_SECONDS = 15


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
        # record the user's prompt as a chat message
        session.add(Message(project_id=project_id, role="user", content=prompt))
        await session.commit()

    # --- 3. Stream generation, persisting files as they arrive ---
    # We hold back the terminal "complete"/"error" event: the assistant chat
    # message is saved FIRST, so by the time the client sees the terminal event
    # everything (files + messages) is already persisted.
    files_written: list[str] = []
    terminal: dict | None = None
    try:
        async for event in stream_generation(
            user_id=str(user_uuid), project_id=str(project_id), prompt=prompt
        ):
            etype = event["type"]
            if etype == "file":
                await _upsert_file(sessionmaker, project_id, event["path"], event["content"])
                files_written.append(event["path"])
                await websocket.send_json(event)
            elif etype in ("complete", "error"):
                terminal = event
                break
            else:  # status, etc.
                await websocket.send_json(event)
    except WebSocketDisconnect:
        return  # client went away; the generation thread finishes on its own
    except Exception as exc:  # noqa: BLE001
        terminal = {"type": "error", "message": str(exc)}

    # --- 4. Save the assistant summary, THEN emit the terminal event ---
    if terminal is not None and terminal.get("type") == "error":
        summary = f"Generation failed: {terminal.get('message', 'unknown error')}"
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
