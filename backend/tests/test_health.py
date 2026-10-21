from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from backend.app import main as main_module
from backend.app.main import app

client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "service": "agrios-api",
        "version": "0.1.0",
    }


def test_readiness_endpoint_when_database_is_connected() -> None:
    response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "service": "agrios-api",
        "database": "connected",
    }


def test_readiness_endpoint_when_database_is_unavailable(
    monkeypatch,
) -> None:
    class UnavailableEngine:
        def connect(self):
            raise SQLAlchemyError("Simulated database failure")

    monkeypatch.setattr(
        main_module,
        "engine",
        UnavailableEngine(),
    )

    response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json() == {
        "detail": "Database connection unavailable",
    }
