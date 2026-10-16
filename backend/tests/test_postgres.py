import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base, get_db
from backend.app.main import app


TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")


@pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="PostgreSQL integration database is not configured",
)
def test_postgres_farm_workflow():
    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)

    # All application models are registered by importing app above.
    Base.metadata.create_all(bind=engine)

    previous_overrides = app.dependency_overrides.copy()

    try:
        with engine.connect() as connection:
            transaction = connection.begin()

            testing_session = sessionmaker(
                bind=connection,
                expire_on_commit=False,
                join_transaction_mode="create_savepoint",
            )

            def override_get_db():
                with testing_session() as session:
                    yield session

            app.dependency_overrides[get_db] = override_get_db
            client = TestClient(app)

            try:
                registration = client.post(
                    "/api/auth/register",
                    json={
                        "name": "Postgres Test",
                        "email": f"test-{uuid4().hex}@example.com",
                        "password": "postgres-test-password",
                    },
                )
                assert registration.status_code == 201, registration.text

                headers = {
                    "Authorization": (
                        f"Bearer {registration.json()['access_token']}"
                    )
                }

                assert client.get(
                    "/api/auth/me",
                    headers=headers,
                ).status_code == 200

                created = client.post(
                    "/api/crop-cycles",
                    headers=headers,
                    json={
                        "field_name": "Postgres field",
                        "area": 2,
                        "area_unit": "acres",
                        "sowing_date": "2026-01-01",
                    },
                )
                assert created.status_code == 201, created.text
                cycle_id = created.json()["id"]

                records = {
                    "irrigation": {
                        "irrigation_date": "2026-01-20",
                        "method": "drip",
                    },
                    "expenses": {
                        "expense_date": "2026-01-20",
                        "category": "seeds",
                        "amount": "125.75",
                    },
                    "harvests": {
                        "harvest_date": "2026-04-15",
                        "quantity": "2.5",
                        "unit": "quintal",
                    },
                    "sales": {
                        "sale_date": "2026-04-16",
                        "quantity": "100",
                        "unit": "kg",
                        "total_value": "2500",
                    },
                }

                for resource, payload in records.items():
                    response = client.post(
                        f"/api/crop-cycles/{cycle_id}/{resource}",
                        headers=headers,
                        json=payload,
                    )
                    assert response.status_code == 201, response.text

                response = client.get(
                    f"/api/crop-cycles/{cycle_id}/sales",
                    headers=headers,
                )
                assert response.status_code == 200, response.text

                summary = response.json()
                assert summary["total_harvested_grams"] == 250000
                assert summary["total_sold_grams"] == 100000
                assert summary["total_sales_value_paise"] == 250000
                assert summary["total_recorded_expenses_paise"] == 12575
                assert summary["recorded_balance_paise"] == 237425

                reopened = client.get(
                    f"/api/crop-cycles/{cycle_id}",
                    headers=headers,
                )
                assert reopened.status_code == 200
                assert reopened.json()["field"]["name"] == "Postgres field"

            finally:
                client.close()
                transaction.rollback()

    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        engine.dispose()