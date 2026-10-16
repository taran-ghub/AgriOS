from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.database import Base, get_db
from backend.app.main import app


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection: object, _: object) -> None:
        cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    testing_session = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db() -> Generator[Session, None, None]:
        with testing_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def register_user(
    client: TestClient,
    *,
    name: str = "Test Farmer",
    email: str = "farmer@example.com",
    password: str = "strong-pass-123",
) -> dict[str, str]:
    response = client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": password},
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_create_and_reopen_crop_cycle(client: TestClient) -> None:
    headers = register_user(client)
    response = client.post(
        "/api/crop-cycles",
        headers=headers,
        json={
            "field_name": "North field",
            "area": 4.5,
            "area_unit": "acres",
            "location": "Karnal, Haryana",
            "sowing_date": "2026-11-05",
        },
    )

    assert response.status_code == 201
    created = response.json()
    assert created["field"]["name"] == "North field"
    assert created["crop"] == "wheat"
    assert created["schedule_version"] == "sample-wheat-v1"
    assert len(created["tasks"]) == 8
    assert created["tasks"][0]["due_date"] == "2026-10-22"

    reopened = client.get(f"/api/crop-cycles/{created['id']}", headers=headers)
    assert reopened.status_code == 200
    assert reopened.json() == created


def test_update_task_status_and_date(client: TestClient) -> None:
    headers = register_user(client)
    created = client.post(
        "/api/crop-cycles",
        headers=headers,
        json={
            "field_name": "Canal field",
            "area": 16,
            "area_unit": "kanal",
            "sowing_date": "2026-11-10",
        },
    ).json()
    task_id = created["tasks"][0]["id"]

    response = client.patch(
        f"/api/tasks/{task_id}",
        headers=headers,
        json={"status": "postponed", "due_date": "2026-10-30"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "postponed"
    assert response.json()["due_date"] == "2026-10-30"


def test_rejects_invalid_area(client: TestClient) -> None:
    headers = register_user(client)
    response = client.post(
        "/api/crop-cycles",
        headers=headers,
        json={
            "field_name": "Invalid field",
            "area": 0,
            "area_unit": "acres",
            "sowing_date": "2026-11-05",
        },
    )

    assert response.status_code == 422


def test_missing_crop_cycle_returns_not_found(client: TestClient) -> None:
    headers = register_user(client)
    response = client.get("/api/crop-cycles/999", headers=headers)
    assert response.status_code == 404


def test_authentication_is_required(client: TestClient) -> None:
    response = client.post(
        "/api/crop-cycles",
        json={
            "field_name": "Private field",
            "area": 2,
            "area_unit": "acres",
            "sowing_date": "2026-11-05",
        },
    )
    assert response.status_code == 401


def test_account_cannot_access_another_accounts_records(client: TestClient) -> None:
    owner_headers = register_user(client)
    created = client.post(
        "/api/crop-cycles",
        headers=owner_headers,
        json={
            "field_name": "Owner field",
            "area": 3,
            "area_unit": "acres",
            "sowing_date": "2026-11-05",
        },
    ).json()

    other_headers = register_user(
        client,
        name="Other Farmer",
        email="other@example.com",
    )
    crop_response = client.get(
        f"/api/crop-cycles/{created['id']}", headers=other_headers
    )
    task_response = client.patch(
        f"/api/tasks/{created['tasks'][0]['id']}",
        headers=other_headers,
        json={"status": "completed"},
    )

    assert crop_response.status_code == 404
    assert task_response.status_code == 404


def test_login_and_logout(client: TestClient) -> None:
    register_user(client)

    login_response = client.post(
        "/api/auth/login",
        json={"email": "FARMER@example.com", "password": "strong-pass-123"},
    )
    assert login_response.status_code == 200
    headers = {
        "Authorization": f"Bearer {login_response.json()['access_token']}"
    }
    assert client.get("/api/auth/me", headers=headers).status_code == 200
    assert client.post("/api/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_duplicate_email_is_rejected(client: TestClient) -> None:
    register_user(client)
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Duplicate",
            "email": "FARMER@example.com",
            "password": "another-pass-123",
        },
    )
    assert response.status_code == 409
