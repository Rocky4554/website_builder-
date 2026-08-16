"""Project CRUD endpoints.

SECURITY INVARIANT: every query is filtered by the authenticated user's id
(from the verified JWT). A user can never read or mutate another user's project.
The user id is never taken from the request body or path — only from the token.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.db.database import get_session
from backend.db.models import Message, Project, ProjectFile
from backend.schemas.project import (
    FileMetaOut,
    FileOut,
    MessageOut,
    ProjectCreate,
    ProjectDetailOut,
    ProjectOut,
    ProjectUpdate,
)
from backend.security.auth import CurrentUser, get_current_user

router = APIRouter(prefix="/projects", tags=["projects"])


def _user_uuid(user: CurrentUser) -> uuid.UUID:
    """Codex puts a UUID string in the token; reject anything malformed."""
    try:
        return uuid.UUID(user.id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token user id is not a valid UUID",
        )


async def _owned_project(
    project_id: uuid.UUID, user_id: uuid.UUID, session: AsyncSession
) -> Project:
    """Load a project ONLY if it belongs to this user, else 404 (not 403, so we
    don't leak whether the id exists)."""
    result = await session.execute(
        select(Project)
        .where(Project.id == project_id, Project.user_id == user_id)
        .options(selectinload(Project.files))
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


async def _assert_owned(
    project_id: uuid.UUID, user_id: uuid.UUID, session: AsyncSession
) -> None:
    """Cheap ownership gate (no eager-loading) for sub-resource reads."""
    owner_ok = await session.scalar(
        select(Project.id).where(Project.id == project_id, Project.user_id == user_id)
    )
    if owner_ok is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")


@router.get("", response_model=list[ProjectOut])
async def list_projects(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[Project]:
    uid = _user_uuid(user)
    result = await session.execute(
        select(Project).where(Project.user_id == uid).order_by(Project.updated_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Project:
    uid = _user_uuid(user)
    project = Project(user_id=uid, name=body.name, description=body.description)
    session.add(project)
    await session.flush()  # populate id/timestamps before response serialization
    return project


@router.get("/{project_id}", response_model=ProjectDetailOut)
async def get_project(
    project_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Project:
    return await _owned_project(project_id, _user_uuid(user), session)


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Project:
    project = await _owned_project(project_id, _user_uuid(user), session)
    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    project = await _owned_project(project_id, _user_uuid(user), session)
    await session.delete(project)


# --- Sub-resources: chat history & files (all owner-scoped) ------------------

@router.get("/{project_id}/messages", response_model=list[MessageOut])
async def list_messages(
    project_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[Message]:
    await _assert_owned(project_id, _user_uuid(user), session)
    result = await session.execute(
        select(Message)
        .where(Message.project_id == project_id)
        .order_by(Message.created_at.asc())
    )
    return list(result.scalars().all())


@router.get("/{project_id}/files", response_model=list[FileMetaOut])
async def list_files(
    project_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ProjectFile]:
    """File tree: metadata only (no content) so it's cheap for large projects."""
    await _assert_owned(project_id, _user_uuid(user), session)
    result = await session.execute(
        select(ProjectFile)
        .where(ProjectFile.project_id == project_id)
        .order_by(ProjectFile.path.asc())
    )
    return list(result.scalars().all())


@router.get("/{project_id}/files/{file_id}", response_model=FileOut)
async def get_file(
    project_id: uuid.UUID,
    file_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ProjectFile:
    """Single file WITH content (for opening it in the editor)."""
    await _assert_owned(project_id, _user_uuid(user), session)
    result = await session.execute(
        select(ProjectFile).where(
            ProjectFile.id == file_id, ProjectFile.project_id == project_id
        )
    )
    file = result.scalar_one_or_none()
    if file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return file
