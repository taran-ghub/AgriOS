from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.browser_security import COOKIE_NAME
from backend.app.database import Base, get_db
from backend.app.main import app

ORIGIN = "http://localhost:5173"
BROWSER_HEADERS = {"Origin": ORIGIN}


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    testing_session = sessionmaker(
        bind=engine,
        expire_on_commit=False,
    )

    Base.metadata.create_all(bind=engine)

    def override_get_db():
        with testing_session() as session:
            yield session

    previous_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_get_db

    test_client = TestClient(app)

    try:
        yield test_client
    finally:
        test_client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def register_browser(client: TestClient):
    response = client.post(
        "/api/auth/session/register",
        headers=BROWSER_HEADERS,
        json={
            "name": "Browser Farmer",
            "email": "browser@example.com",
            "password": "browser-test-password",
        },
    )

    assert response.status_code == 201, response.text
    return response


def test_browser_registration_uses_http_only_cookie(client: TestClient):
    response = register_browser(client)

    assert "access_token" not in response.json()
    assert response.json()["user"]["email"] == "browser@example.com"

    cookie_header = response.headers["set-cookie"].lower()

    assert "httponly" in cookie_header
    assert "samesite=lax" in cookie_header
    assert "path=/api" in cookie_header
    assert "no-store" in response.headers["cache-control"]
    assert client.cookies.get(COOKIE_NAME)

    # No Authorization header: the client sends its cookie.
    me = client.get("/api/auth/me")

    assert me.status_code == 200
    assert me.json()["email"] == "browser@example.com"


def test_cookie_allows_changes_from_our_frontend(client: TestClient):
    register_browser(client)

    response = client.post(
        "/api/crop-cycles",
        headers=BROWSER_HEADERS,
        json={
            "field_name": "Cookie field",
            "area": 2,
            "area_unit": "acres",
            "sowing_date": "2026-01-01",
        },
    )

    assert response.status_code == 201, response.text

    task_id = response.json()["tasks"][0]["id"]

    updated = client.patch(
        f"/api/tasks/{task_id}",
        headers=BROWSER_HEADERS,
        json={"status": "completed"},
    )

    assert updated.status_code == 200
    assert updated.json()["status"] == "completed"


def test_cookie_rejects_missing_or_untrusted_origin(client: TestClient):
    register_browser(client)

    payload = {
        "field_name": "Blocked field",
        "area": 2,
        "area_unit": "acres",
        "sowing_date": "2026-01-01",
    }

    for headers in (
        {},
        {"Origin": "https://untrusted.example"},
    ):
        response = client.post(
            "/api/crop-cycles",
            headers=headers,
            json=payload,
        )

        assert response.status_code == 403, response.text

    plans = client.get("/api/crop-cycles")

    assert plans.status_code == 200
    assert plans.json() == []


def test_browser_login_rejects_untrusted_origin(client: TestClient):
    register_browser(client)

    response = client.post(
        "/api/auth/session/login",
        headers={"Origin": "https://untrusted.example"},
        json={
            "email": "browser@example.com",
            "password": "browser-test-password",
        },
    )

    assert response.status_code == 403


def test_logout_revokes_cookie_and_login_works_again(client: TestClient):
    register_browser(client)
    old_token = client.cookies.get(COOKIE_NAME)

    response = client.post(
        "/api/auth/session/logout",
        headers=BROWSER_HEADERS,
    )

    assert response.status_code == 204
    assert client.get("/api/auth/me").status_code == 401

    # The old session must be invalid even if someone reuses its token.
    reused = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {old_token}"},
    )
    assert reused.status_code == 401

    login = client.post(
        "/api/auth/session/login",
        headers=BROWSER_HEADERS,
        json={
            "email": "browser@example.com",
            "password": "browser-test-password",
        },
    )

    assert login.status_code == 200, login.text
    assert "access_token" not in login.json()
    assert client.get("/api/auth/me").status_code == 200
