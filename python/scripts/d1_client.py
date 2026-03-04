"""Cloudflare D1 REST API client for enrichment scripts.

Reads credentials from environment variables (or .env file in pipeline-dashboard).

Required env vars:
    CF_ACCOUNT_ID       — Cloudflare account ID
    CF_D1_DATABASE_ID   — Production D1 database ID
    CF_API_TOKEN        — API token with D1:edit permission
"""

import json
import os
from pathlib import Path

import requests

CF_API = "https://api.cloudflare.com/client/v4"


def _load_env() -> None:
    """Load env vars from pipeline-dashboard/.env if they aren't already set."""
    if os.environ.get("CF_ACCOUNT_ID"):
        return
    env_file = Path(__file__).parent.parent.parent / "tools" / "pipeline-dashboard" / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if key and value and key not in os.environ:
            os.environ[key] = value


class D1Client:
    """Thin wrapper around the Cloudflare D1 REST API."""

    def __init__(self) -> None:
        _load_env()
        self.account_id = os.environ.get("CF_ACCOUNT_ID", "")
        self.database_id = os.environ.get("CF_D1_DATABASE_ID", "")
        self.token = os.environ.get("CF_API_TOKEN", "")

        missing = []
        if not self.account_id:
            missing.append("CF_ACCOUNT_ID")
        if not self.database_id:
            missing.append("CF_D1_DATABASE_ID")
        if not self.token:
            missing.append("CF_API_TOKEN")
        if missing:
            raise EnvironmentError(
                f"Missing env vars: {', '.join(missing)}. "
                f"Set them or create tools/pipeline-dashboard/.env"
            )

        self.url = f"{CF_API}/accounts/{self.account_id}/d1/database/{self.database_id}/query"
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    def query(self, sql: str, params: list | None = None) -> list[dict]:
        """Execute a SELECT and return rows as dicts."""
        resp = requests.post(
            self.url,
            headers=self.headers,
            json={"sql": sql, "params": params or []},
        )
        resp.raise_for_status()
        body = resp.json()
        if not body.get("success"):
            raise RuntimeError(f"D1 query failed: {body.get('errors', [])}")
        return body["result"][0]["results"]

    def execute(self, sql: str, params: list | None = None) -> dict:
        """Execute an INSERT/UPDATE/DELETE and return meta."""
        resp = requests.post(
            self.url,
            headers=self.headers,
            json={"sql": sql, "params": params or []},
        )
        resp.raise_for_status()
        body = resp.json()
        if not body.get("success"):
            raise RuntimeError(f"D1 execute failed: {body.get('errors', [])}")
        return body["result"][0]["meta"]
