"""Smoke tests for the review graph (no live LLM required)."""

from graphs.review_graph import run_review
from schemas.models import ReviewRequest


def test_run_review_empty_diff():
    result = run_review(ReviewRequest(diff=""))
    assert result.status == "completed"
    assert result.request_id
    assert result.duration_ms is not None
    assert result.recommendation in {"approve", "request_changes", "comment"}


def test_run_review_with_focus():
    from schemas.models import ReviewCategory

    result = run_review(
        ReviewRequest(
            diff="+ print('hello')\n",
            focus=[ReviewCategory.SECURITY, ReviewCategory.CORRECTNESS],
        )
    )
    assert result.status == "completed"
    assert len(result.agents_involved) >= 1
