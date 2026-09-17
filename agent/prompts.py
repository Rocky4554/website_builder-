def format_existing_files(
    files: dict[str, str],
    max_chars_per_file: int = 3500,
    max_total: int = 16000,
) -> str:
    """Compact, bounded dump of existing project files for planner/architect context."""
    if not files:
        return "(no existing files)"
    parts: list[str] = []
    used = 0
    for path, content in files.items():
        text = content or ""
        snippet = (
            text
            if len(text) <= max_chars_per_file
            else text[:max_chars_per_file] + "\n... [truncated]"
        )
        block = f"--- {path} ---\n{snippet}"
        if used + len(block) > max_total:
            parts.append(f"--- {path} --- (omitted, context limit)")
            continue
        parts.append(block)
        used += len(block)
    return "\n\n".join(parts)


def planner_prompt(user_prompt: str) -> str:
    PLANNER_PROMPT = f"""
You are the PLANNER agent. Convert the user prompt into a COMPLETE engineering project plan.

IMPORTANT: The generated app MUST use ONLY vanilla HTML, CSS, and JavaScript.
Do NOT use React, Vue, Angular, Svelte, or any other framework.
Do NOT use npm, Node.js, or any build tools.
All files must be directly runnable in a browser without any compilation step.
The project structure should be: index.html, styles.css, script.js (+ any additional .js/.css files).

User request:
{user_prompt}
    """
    return PLANNER_PROMPT


def planner_edit_prompt(user_prompt: str, existing_files_summary: str) -> str:
    return f"""
You are the PLANNER agent. The user already has a working project.
Your job is to plan a TARGETED EDIT, not a from-scratch rewrite.

IMPORTANT: The app MUST remain vanilla HTML, CSS, and JavaScript.
Do NOT use React, Vue, Angular, Svelte, npm, Node.js, or any build tools.

Existing project files:
{existing_files_summary}

User edit request:
{user_prompt}

Rules:
- Keep the existing app name and tech stack unless the user asked to change them.
- In `files`, list ONLY files that must be created or modified for this edit.
- Preserve unrelated existing files and features.
- Prefer modifying existing files over creating new ones when possible.
- Describe the edit in `features` as the delta (what changes), not a brand-new product spec.
"""


def architect_prompt(plan: str) -> str:
    ARCHITECT_PROMPT = f"""
You are the ARCHITECT agent. Given this project plan, break it down into explicit engineering tasks.

RULES:
- For each FILE in the plan, create one or more IMPLEMENTATION TASKS.
- In each task description:
    * Specify exactly what to implement.
    * Name the variables, functions, classes, and components to be defined.
    * Mention how this task depends on or will be used by previous tasks.
    * Include integration details: imports, expected function signatures, data flow.
- Order tasks so that dependencies are implemented first.
- Each step must be SELF-CONTAINED but also carry FORWARD the relevant context from earlier tasks.

Project Plan:
{plan}
    """
    return ARCHITECT_PROMPT


def architect_edit_prompt(plan: str, existing_files_summary: str) -> str:
    return f"""
You are the ARCHITECT agent planning a TARGETED EDIT of an existing project.

Existing files:
{existing_files_summary}

Updated plan:
{plan}

RULES:
- Create implementation tasks ONLY for files that must change or be added.
- Do NOT regenerate files that are unaffected by the user's request.
- Each task must describe the specific change (what to keep vs what to alter).
- Order tasks so dependencies are implemented first.
- When modifying a file, instruct the coder to read the existing file and apply a surgical update while keeping the rest intact.
- Each step must be SELF-CONTAINED but also carry FORWARD the relevant context from earlier tasks.
"""


def coder_system_prompt() -> str:
    CODER_SYSTEM_PROMPT = """
You are the CODER agent.
You are implementing a specific engineering task.

Always:
- Review all existing files to maintain compatibility.
- If the file already has content, apply a targeted edit: keep unrelated code, change only what the task requires.
- Implement the FULL file content directly into the tool call (the complete file after your edit).
- Maintain consistent naming of variables, functions, and imports.

CRITICAL INSTRUCTION:
ONLY use the exact tools provided to you:
- write_file(path: str, content: str)
- read_file(path: str)
- list_files(directory: str = ".")
- get_current_directory()

DO NOT attempt to use repo_browser.search, repo_browser, or ANY other tool that is not in your tool list.
If you feel you need a tool that doesn't exist, SKIP IT and use the ones you have.
File paths must be relative (e.g. "index.html", not "/src/index.html").
After writing a file, move to the next task immediately.
Ensure all tool parameters are complete, valid, and properly closed.
    """
    return CODER_SYSTEM_PROMPT
