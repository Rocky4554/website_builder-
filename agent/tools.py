import contextvars
import pathlib
import subprocess
from typing import Callable, Optional, Tuple

from langchain_core.tools import tool

# Default root for CLI / single-user use (unchanged behaviour for `main.py`).
DEFAULT_PROJECT_ROOT = pathlib.Path.cwd() / "generated_project"

# Per-run context. The server sets these per generation so concurrent users
# each write into their OWN  workspaces/<user_id>/<project_id>/  folder, and so
# every file write can be mirrored to the DB / streamed to the client.
# contextvars are copied into the worker thread by asyncio.to_thread, so the
# agent (which runs in that thread) sees the right root.
_ctx_root: contextvars.ContextVar[Optional[pathlib.Path]] = contextvars.ContextVar(
    "wb_project_root", default=None
)
_ctx_on_write: contextvars.ContextVar[Optional[Callable[[str, str], None]]] = contextvars.ContextVar(
    "wb_on_write", default=None
)


def set_run_context(root: "pathlib.Path | str", on_write: Optional[Callable[[str, str], None]] = None) -> None:
    """Bind the active workspace root (and optional file-write callback) for the
    current context/thread. Call this at the start of a generation run."""
    _ctx_root.set(pathlib.Path(root))
    _ctx_on_write.set(on_write)


def project_root() -> pathlib.Path:
    return _ctx_root.get() or DEFAULT_PROJECT_ROOT


def safe_path_for_project(path: str) -> pathlib.Path:
    root = project_root().resolve()
    p = (root / path).resolve()
    if root != p and root not in p.parents:
        raise ValueError("Attempt to write outside project root")
    return p


@tool
def write_file(path: str, content: str) -> str:
    """Writes content to a file at the specified path within the project root."""
    p = safe_path_for_project(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content)
    # Notify the server (mirror to DB / stream to client) if a callback is bound.
    on_write = _ctx_on_write.get()
    if on_write is not None:
        rel = str(p.relative_to(project_root().resolve())).replace("\\", "/")
        on_write(rel, content)
    return f"WROTE:{p}"


@tool
def read_file(path: str) -> str:
    """Reads content from a file at the specified path within the project root."""
    p = safe_path_for_project(path)
    if not p.exists():
        return ""
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


@tool
def get_current_directory() -> str:
    """Returns the current working directory."""
    return str(project_root())


@tool
def list_files(directory: str = ".") -> str:
    """Lists all files in the specified directory within the project root."""
    p = safe_path_for_project(directory)
    if not p.is_dir():
        return f"ERROR: {p} is not a directory"
    root = project_root()
    files = [str(f.relative_to(root)) for f in p.glob("**/*") if f.is_file()]
    return "\n".join(files) if files else "No files found."


@tool
def run_cmd(cmd: str, cwd: str = None, timeout: int = 30) -> Tuple[int, str, str]:
    """Runs a shell command in the specified directory and returns the result."""
    cwd_dir = safe_path_for_project(cwd) if cwd else project_root()
    res = subprocess.run(cmd, shell=True, cwd=str(cwd_dir), capture_output=True, text=True, timeout=timeout)
    return res.returncode, res.stdout, res.stderr


def init_project_root() -> str:
    root = project_root()
    root.mkdir(parents=True, exist_ok=True)
    return str(root)
