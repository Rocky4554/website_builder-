import os
import time
import logging

from dotenv import load_dotenv
from langchain_core.globals import set_verbose, set_debug
from langchain_groq.chat_models import ChatGroq
from langgraph.checkpoint.memory import MemorySaver
from langgraph.constants import END
from langgraph.graph import StateGraph
from langgraph.prebuilt import create_react_agent
from langgraph.types import interrupt

from agent.prompts import (
    architect_edit_prompt,
    architect_prompt,
    coder_system_prompt,
    format_existing_files,
    planner_edit_prompt,
    planner_prompt,
)
from agent.states import CoderState, ImplementationTask, Plan, TaskPlan
from agent.tools import get_current_directory, list_files, read_file, write_file

logger = logging.getLogger("backend.agent")

_ = load_dotenv()

_DEBUG = os.getenv("AGENT_DEBUG", "").strip().lower() in {"1", "true", "yes", "on"}
set_debug(_DEBUG)
set_verbose(_DEBUG)

model_name = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
llm = ChatGroq(
    model=model_name,
    max_tokens=8192,
    temperature=0.1,
    max_retries=3,
    timeout=120,
)


def _existing_summary(state: dict) -> str:
    files = state.get("existing_files") or {}
    if not files:
        return ""
    return format_existing_files(files)


def _serialize_plan(state: dict) -> dict:
    plan = state.get("plan")
    task_plan = state.get("task_plan")
    if plan is None and task_plan is not None:
        plan = getattr(task_plan, "plan", None)
    plan_data = plan.model_dump() if hasattr(plan, "model_dump") else (plan or {})
    tasks = []
    if task_plan is not None and hasattr(task_plan, "implementation_steps"):
        tasks = [step.model_dump() for step in task_plan.implementation_steps]
    return {
        "app_name": plan_data.get("name"),
        "description": plan_data.get("description"),
        "features": plan_data.get("features") or [],
        "tech_stack": [plan_data.get("techstack")] if plan_data.get("techstack") else [],
        "files": plan_data.get("files") or [],
        "tasks": tasks,
    }


def planner_agent(state: dict) -> dict:
    logger.info("Starting", extra={"module": "PLANNER"})
    user_prompt = state["user_prompt"]
    logger.debug(f"User Prompt: {user_prompt}", extra={"module": "PLANNER"})
    summary = _existing_summary(state)
    prompt = planner_edit_prompt(user_prompt, summary) if summary else planner_prompt(user_prompt)
    resp = llm.with_structured_output(Plan).invoke(prompt)
    if resp is None:
        raise ValueError("Planner did not return a valid response.")
    logger.info("Finished", extra={"module": "PLANNER"})
    return {"plan": resp}


def architect_agent(state: dict) -> dict:
    logger.info("Starting", extra={"module": "ARCHITECT"})
    plan: Plan = state["plan"]
    summary = _existing_summary(state)
    prompt = (
        architect_edit_prompt(plan.model_dump_json(), summary)
        if summary
        else architect_prompt(plan=plan.model_dump_json())
    )
    resp = llm.with_structured_output(TaskPlan).invoke(prompt)
    if resp is None:
        raise ValueError("Architect did not return a valid response.")
    resp.plan = plan
    logger.debug(resp.model_dump_json(), extra={"module": "ARCHITECT"})
    logger.info("Finished", extra={"module": "ARCHITECT"})
    return {"task_plan": resp}


def plan_gate(state: dict) -> dict:
    """Pause for human approval when mode == plan. Auto mode flows through."""
    mode = str(state.get("mode") or "auto").lower()
    if mode != "plan":
        return {}
    decision = interrupt({"type": "plan_review", "plan": _serialize_plan(state)})
    action = None
    if isinstance(decision, dict):
        action = decision.get("action")
    elif isinstance(decision, str):
        action = decision
    if str(action or "").lower() in {"reject", "cancel"}:
        logger.info("Plan rejected by user", extra={"module": "PLAN_GATE"})
        return {"status": "CANCELLED"}
    logger.info("Plan approved by user", extra={"module": "PLAN_GATE"})
    return {}


def _process_task(current_task: ImplementationTask) -> bool:
    try:
        existing_content = read_file.invoke({"path": current_task.filepath})
    except Exception:
        existing_content = ""

    system_prompt = coder_system_prompt()
    user_prompt = (
        f"Task: {current_task.task_description}\n"
        f"File: {current_task.filepath}\n"
        f"Existing content:\n{existing_content}\n"
        "Use write_file(path, content) to save your changes."
    )

    coder_tools = [read_file, write_file, list_files, get_current_directory]
    react_agent = create_react_agent(llm, coder_tools)

    for attempt in range(3):
        try:
            logger.info(f"File: {current_task.filepath} (Attempt {attempt + 1}/3)", extra={"module": "CODER"})
            react_agent.invoke({"messages": [{"role": "system", "content": system_prompt},
                                             {"role": "user", "content": user_prompt}]})
            return True
        except Exception as e:
            if attempt == 2:
                logger.error(f"FAILED Step after 3 retries: {e}", extra={"module": "CODER", "exc_info": True})
                return False
            sleep_time = 2 ** (attempt + 1)
            logger.warning(f"Error: {e}. Retrying in {sleep_time}s...", extra={"module": "CODER"})
            time.sleep(sleep_time)
    return False


def coder_agent(state: dict) -> dict:
    logger.info("Starting sequential code generation", extra={"module": "CODER"})
    coder_state: CoderState = state.get("coder_state")
    if coder_state is None:
        coder_state = CoderState(task_plan=state["task_plan"], current_step_idx=0)

    steps = coder_state.task_plan.implementation_steps
    if coder_state.current_step_idx >= len(steps):
        logger.info("All steps DONE", extra={"module": "CODER"})
        return {"coder_state": coder_state, "status": "DONE", "failed_files": []}

    # Sequential: Architect orders tasks so later files can read earlier ones.
    remaining_steps = steps[coder_state.current_step_idx:]
    failed_files: list[str] = []
    for step in remaining_steps:
        ok = _process_task(step)
        coder_state.current_step_idx += 1
        if not ok:
            failed_files.append(step.filepath)

    if failed_files:
        logger.error(f"Partial failure: {failed_files}", extra={"module": "CODER"})
        return {"coder_state": coder_state, "status": "PARTIAL", "failed_files": failed_files}

    logger.info("All steps DONE", extra={"module": "CODER"})
    return {"coder_state": coder_state, "status": "DONE", "failed_files": []}


def _after_plan_gate(state: dict) -> str:
    if state.get("status") == "CANCELLED":
        return "END"
    return "coder"


def _after_coder(state: dict) -> str:
    if state.get("status") in {"DONE", "PARTIAL", "CANCELLED"}:
        return "END"
    return "coder"


graph = StateGraph(dict)
graph.add_node("planner", planner_agent)
graph.add_node("architect", architect_agent)
graph.add_node("plan_gate", plan_gate)
graph.add_node("coder", coder_agent)
graph.add_edge("planner", "architect")
graph.add_edge("architect", "plan_gate")
graph.add_conditional_edges("plan_gate", _after_plan_gate, {"coder": "coder", "END": END})
graph.add_conditional_edges("coder", _after_coder, {"END": END, "coder": "coder"})
graph.set_entry_point("planner")

# Checkpointer is required so Plan Mode can pause before the coder and resume later.
_checkpointer = MemorySaver()
agent = graph.compile(checkpointer=_checkpointer)

if __name__ == "__main__":
    result = agent.invoke(
        {"user_prompt": "Build a colourful modern todo app in html css and js", "mode": "auto"},
        {"recursion_limit": 100, "configurable": {"thread_id": "cli"}},
    )
    print("Final State:", result)
