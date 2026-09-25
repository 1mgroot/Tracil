"""Default tests must never make paid model requests."""

import httpx
import pytest


@pytest.fixture(autouse=True)
def no_model_http(monkeypatch):
    monkeypatch.setenv("LANGSMITH_TRACING", "false")
    monkeypatch.setenv("LANGCHAIN_TRACING_V2", "false")

    def blocked(*args, **kwargs):
        raise AssertionError("Tests cannot make outbound HTTP/model calls")

    async def blocked_async(*args, **kwargs):
        raise AssertionError("Tests cannot make outbound HTTP/model calls")

    # TestClient uses an in-memory transport, so real API handlers still run.
    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", blocked)
    monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", blocked_async)
