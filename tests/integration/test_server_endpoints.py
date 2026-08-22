"""
Integration tests for FastAPI companion server routes.
"""

from fastapi.testclient import TestClient
from deep_browser.server.app import app

client = TestClient(app)


def test_health_check_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "Deep-Browser"


def test_list_tasks_empty():
    response = client.get("/api/tasks")
    assert response.status_code == 200
    data = response.json()
    assert "tasks" in data


def test_list_sessions_endpoint():
    response = client.get("/api/sessions")
    assert response.status_code == 200
    data = response.json()
    assert "sessions" in data


def test_list_artifacts_endpoint():
    response = client.get("/api/workspace/artifacts")
    assert response.status_code == 200
    data = response.json()
    assert "artifacts" in data
