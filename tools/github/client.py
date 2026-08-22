"""Thin GitHub client used by tools and the PR specialist."""

from __future__ import annotations

import os
from typing import Any

from github import Github, GithubException


class GitHubClient:
    def __init__(self, token: str | None = None):
        self.token = token or os.getenv("GITHUB_TOKEN")
        self._gh = Github(self.token) if self.token else None

    @property
    def available(self) -> bool:
        return self._gh is not None

    def get_pr(self, owner: str, repo: str, number: int) -> dict[str, Any]:
        if not self._gh:
            raise RuntimeError("GITHUB_TOKEN not set")
        pr = self._gh.get_repo(f"{owner}/{repo}").get_pull(number)
        return {
            "title": pr.title,
            "body": pr.body,
            "state": pr.state,
            "user": pr.user.login if pr.user else None,
            "additions": pr.additions,
            "deletions": pr.deletions,
            "changed_files": pr.changed_files,
            "head_sha": pr.head.sha,
            "base_ref": pr.base.ref,
            "html_url": pr.html_url,
            "files": [f.filename for f in pr.get_files()],
        }

    def get_pr_diff(self, owner: str, repo: str, number: int) -> str:
        if not self._gh:
            raise RuntimeError("GITHUB_TOKEN not set")
        pr = self._gh.get_repo(f"{owner}/{repo}").get_pull(number)
        # PyGithub does not expose raw diff directly; use the files patch
        parts = []
        for f in pr.get_files():
            if f.patch:
                parts.append(f"--- a/{f.filename}\n+++ b/{f.filename}\n{f.patch}")
        return "\n".join(parts)

    def post_comment(self, owner: str, repo: str, number: int, body: str) -> str:
        if not self._gh:
            raise RuntimeError("GITHUB_TOKEN not set")
        pr = self._gh.get_repo(f"{owner}/{repo}").get_pull(number)
        comment = pr.create_issue_comment(body)
        return comment.html_url

    def add_labels(self, owner: str, repo: str, number: int, labels: list[str]) -> None:
        if not self._gh:
            raise RuntimeError("GITHUB_TOKEN not set")
        issue = self._gh.get_repo(f"{owner}/{repo}").get_issue(number)
        issue.add_to_labels(*labels)
