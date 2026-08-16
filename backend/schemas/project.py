"""Request/response shapes for project endpoints."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)


class FileMetaOut(BaseModel):
    """Lightweight file entry for the file tree (no content)."""
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    path: str
    updated_at: datetime


class FileOut(FileMetaOut):
    """Full file including content (for opening a file)."""
    content: str


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    role: str
    content: str
    created_at: datetime


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class ProjectDetailOut(ProjectOut):
    files: list[FileOut] = []
