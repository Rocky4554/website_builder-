import os

import pytest


@pytest.mark.skipif(not os.getenv("GROQ_API_KEY"), reason="GROQ_API_KEY not set")
def test_planner_returns_a_plan() -> None:
    from agent.graph import planner_agent

    result = planner_agent({"user_prompt": "Build a tiny vanilla HTML todo list"})
    plan = result["plan"]
    assert plan.name
    assert plan.files
