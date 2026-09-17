from agent.prompts import format_existing_files


def test_format_existing_files_empty() -> None:
    assert format_existing_files({}) == "(no existing files)"


def test_format_existing_files_includes_path_and_content() -> None:
    text = format_existing_files({"index.html": "<h1>Hi</h1>"})
    assert "index.html" in text
    assert "<h1>Hi</h1>" in text


def test_format_existing_files_truncates_long_file() -> None:
    text = format_existing_files({"big.js": "x" * 8000}, max_chars_per_file=100, max_total=1000)
    assert "truncated" in text
