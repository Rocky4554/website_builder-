import pathlib

import pytest

from agent.tools import safe_path_for_project, set_run_context


def test_safe_path_allows_relative_file(tmp_path: pathlib.Path) -> None:
    set_run_context(tmp_path)
    dest = safe_path_for_project("index.html")
    assert dest == (tmp_path / "index.html").resolve()


def test_safe_path_allows_nested_file(tmp_path: pathlib.Path) -> None:
    set_run_context(tmp_path)
    dest = safe_path_for_project("css/styles.css")
    assert dest == (tmp_path / "css" / "styles.css").resolve()


def test_safe_path_rejects_parent_traversal(tmp_path: pathlib.Path) -> None:
    set_run_context(tmp_path)
    with pytest.raises(ValueError, match="outside project root"):
        safe_path_for_project("../secrets.env")


def test_safe_path_rejects_absolute_escape(tmp_path: pathlib.Path) -> None:
    set_run_context(tmp_path)
    with pytest.raises(ValueError, match="outside project root"):
        safe_path_for_project("..")
