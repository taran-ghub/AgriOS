from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.database import Base, get_db
from backend.app.main import app


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    # This database exists only in memory for this test.
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

    # No lifespan startup: tables were created above in the test database.
    test_client = TestClient(app)

    try:
        yield test_client
    finally:
        test_client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def account(client: TestClient, email: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Test Farmer",
            "email": email,
            "password": "test-password-123",
        },
    )

    assert response.status_code == 201, response.text

    return {
        "Authorization": f"Bearer {response.json()['access_token']}"
    }


def crop_plan(client: TestClient, headers: dict[str, str]) -> dict:
    response = client.post(
        "/api/crop-cycles",
        headers=headers,
        json={
            "field_name": "Test field",
            "area": 2,
            "area_unit": "acres",
            "sowing_date": "2026-01-01",
        },
    )

    assert response.status_code == 201, response.text
    return response.json()


def post_record(client, headers, cycle_id, resource, payload):
    response = client.post(
        f"/api/crop-cycles/{cycle_id}/{resource}",
        headers=headers,
        json=payload,
    )

    assert response.status_code == 201, response.text
    return response.json()


def test_expense_total_uses_exact_paise(client: TestClient):
    headers = account(client, "expenses@example.com")
    cycle = crop_plan(client, headers)

    for amount in ("100.50", "25.25"):
        post_record(
            client,
            headers,
            cycle["id"],
            "expenses",
            {
                "expense_date": "2026-01-10",
                "category": "seeds",
                "amount": amount,
            },
        )

    response = client.get(
        f"/api/crop-cycles/{cycle['id']}/expenses",
        headers=headers,
    )

    assert response.status_code == 200
    summary = response.json()

    assert summary["record_count"] == 2
    assert summary["total_recorded_paise"] == 12575


def test_harvest_conversion_and_sales_balance(client: TestClient):
    headers = account(client, "sales@example.com")
    cycle = crop_plan(client, headers)

    for quantity, unit in (("2", "quintal"), ("50", "kg")):
        post_record(
            client,
            headers,
            cycle["id"],
            "harvests",
            {
                "harvest_date": "2026-04-15",
                "quantity": quantity,
                "unit": unit,
            },
        )

    post_record(
        client,
        headers,
        cycle["id"],
        "expenses",
        {
            "expense_date": "2026-01-10",
            "category": "seeds",
            "amount": "125.75",
        },
    )

    post_record(
        client,
        headers,
        cycle["id"],
        "sales",
        {
            "sale_date": "2026-04-16",
            "quantity": "100",
            "unit": "kg",
            "total_value": "2500",
        },
    )

    response = client.get(
        f"/api/crop-cycles/{cycle['id']}/sales",
        headers=headers,
    )

    assert response.status_code == 200
    summary = response.json()

    assert summary["total_harvested_grams"] == 250000
    assert summary["total_sold_grams"] == 100000
    assert summary["total_sales_value_paise"] == 250000
    assert summary["total_recorded_expenses_paise"] == 12575
    assert summary["recorded_balance_paise"] == 237425
    assert summary["harvest_minus_sales_grams"] == 150000
    assert summary["sales_exceed_recorded_harvest"] is False


def test_sales_without_recorded_harvest_are_flagged(client: TestClient):
    headers = account(client, "missing-harvest@example.com")
    cycle = crop_plan(client, headers)

    post_record(
        client,
        headers,
        cycle["id"],
        "sales",
        {
            "sale_date": "2026-04-16",
            "quantity": "10",
            "unit": "kg",
            "total_value": "250",
        },
    )

    response = client.get(
        f"/api/crop-cycles/{cycle['id']}/sales",
        headers=headers,
    )

    assert response.status_code == 200
    summary = response.json()

    assert summary["sales_exceed_recorded_harvest"] is True
    assert summary["harvest_minus_sales_grams"] == -10000


def test_other_account_cannot_read_or_add_records(client: TestClient):
    owner = account(client, "owner@example.com")
    other = account(client, "other@example.com")
    cycle = crop_plan(client, owner)

    payloads = {
        "irrigation": {
            "irrigation_date": "2026-01-20",
            "method": "drip",
        },
        "expenses": {
            "expense_date": "2026-01-20",
            "category": "seeds",
            "amount": "100",
        },
        "harvests": {
            "harvest_date": "2026-04-15",
            "quantity": "50",
            "unit": "kg",
        },
        "sales": {
            "sale_date": "2026-04-16",
            "quantity": "10",
            "unit": "kg",
            "total_value": "250",
        },
    }

    for resource, payload in payloads.items():
        url = f"/api/crop-cycles/{cycle['id']}/{resource}"

        # Confirm that the owner can use this endpoint.
        post_record(
            client,
            owner,
            cycle["id"],
            resource,
            payload,
        )

        assert client.get(url, headers=other).status_code == 404

        assert client.post(
            url,
            headers=other,
            json=payload,
        ).status_code == 404

    plans = client.get("/api/crop-cycles", headers=other)
    assert plans.status_code == 200
    assert plans.json() == []


def test_invalid_money_and_harvest_dates_are_rejected(client: TestClient):
    headers = account(client, "validation@example.com")
    cycle = crop_plan(client, headers)

    for amount in ("0", "-1", "10.001"):
        response = client.post(
            f"/api/crop-cycles/{cycle['id']}/expenses",
            headers=headers,
            json={
                "expense_date": "2026-01-20",
                "category": "seeds",
                "amount": amount,
            },
        )
        assert response.status_code == 422, response.text

    response = client.post(
        f"/api/crop-cycles/{cycle['id']}/harvests",
        headers=headers,
        json={
            "harvest_date": "2025-12-31",
            "quantity": "50",
            "unit": "kg",
        },
    )

    assert response.status_code == 422

    summary = client.get(
        f"/api/crop-cycles/{cycle['id']}/expenses",
        headers=headers,
    ).json()

    assert summary["record_count"] == 0


def test_today_groups_dates_and_excludes_other_accounts(client: TestClient):
    owner = account(client, "today-owner@example.com")
    other = account(client, "today-other@example.com")

    cycle = crop_plan(client, owner)
    crop_plan(client, other)

    # Give every owner task a known state.
    for task in cycle["tasks"]:
        response = client.patch(
            f"/api/tasks/{task['id']}",
            headers=owner,
            json={"status": "completed"},
        )
        assert response.status_code == 200

    changes = [
        ("2026-04-09", "pending"),     # Overdue
        ("2026-04-10", "pending"),     # Today
        ("2026-04-17", "postponed"),   # Seventh day: included
        ("2026-04-18", "pending"),     # Beyond seven days: excluded
        ("2026-04-10", "skipped"),     # Skipped: excluded
    ]

    for task, (due_date, task_status) in zip(
        cycle["tasks"],
        changes,
    ):
        response = client.patch(
            f"/api/tasks/{task['id']}",
            headers=owner,
            json={
                "due_date": due_date,
                "status": task_status,
            },
        )
        assert response.status_code == 200

    response = client.get(
        "/api/today",
        headers=owner,
        params={"on_date": "2026-04-10"},
    )

    assert response.status_code == 200
    overview = response.json()

    assert overview["overdue"]["total_count"] == 1
    assert overview["due_today"]["total_count"] == 1
    assert overview["upcoming"]["total_count"] == 1

    for group_name in ("overdue", "due_today", "upcoming"):
        for task in overview[group_name]["tasks"]:
            assert task["crop_cycle_id"] == cycle["id"]