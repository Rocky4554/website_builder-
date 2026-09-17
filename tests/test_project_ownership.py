import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.api.projects import _owned_project
from backend.db.models import Base, Project


@pytest.mark.asyncio
async def test_owned_project_returns_for_owner() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    owner = uuid.uuid4()
    async with Session() as session:
        project = Project(user_id=owner, name="Mine")
        session.add(project)
        await session.commit()
        await session.refresh(project)
        found = await _owned_project(project.id, owner, session)
        assert found.id == project.id
    await engine.dispose()


@pytest.mark.asyncio
async def test_owned_project_404_for_other_user() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    owner = uuid.uuid4()
    other = uuid.uuid4()
    async with Session() as session:
        project = Project(user_id=owner, name="Mine")
        session.add(project)
        await session.commit()
        await session.refresh(project)
        with pytest.raises(HTTPException) as exc:
            await _owned_project(project.id, other, session)
        assert exc.value.status_code == 404
        assert exc.value.detail == "Project not found"
    await engine.dispose()
