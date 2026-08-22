"""Unit tests for Pydantic schemas."""

from schemas.models import Finding, ReviewCategory, ReviewRequest, ReviewResult, Severity


def test_finding_roundtrip():
    f = Finding(
        id="f1",
        category=ReviewCategory.SECURITY,
        severity=Severity.HIGH,
        title="Hardcoded secret",
        description="API key in source",
        file_path="config.py",
        line_start=12,
        confidence=0.95,
    )
    data = f.model_dump()
    assert data["severity"] == "high"
    assert Finding(**data).title == "Hardcoded secret"


def test_review_request_defaults():
    r = ReviewRequest(diff="--- a\n+++ b")
    assert r.max_findings == 50
    assert r.include_suggestions is True


def test_review_result_minimal():
    res = ReviewResult(
        request_id="abc",
        status="completed",
        summary="ok",
        findings=[],
        agents_involved=[],
    )
    assert res.recommendation is None
    assert res.score is None
