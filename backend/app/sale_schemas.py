from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SaleCreate(BaseModel):
    sale_date: date

    quantity: Decimal = Field(
        gt=0,
        le=Decimal(1000000),
        max_digits=10,
        decimal_places=3,
        allow_inf_nan=False,
    )

    unit: Literal["kg", "quintal"] = "kg"

    # Total value of this sale in rupees, not price per kg.
    total_value: Decimal = Field(
        gt=0,
        le=Decimal(10000000),
        max_digits=10,
        decimal_places=2,
        allow_inf_nan=False,
    )

    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("notes", mode="before")
    @classmethod
    def clean_notes(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value


class SaleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    crop_cycle_id: int
    sale_date: date
    quantity_grams: int
    total_value_paise: int
    notes: str | None
    created_at: datetime


class SalesOverview(BaseModel):
    currency: Literal["INR"] = "INR"

    total_sold_grams: int
    total_sales_value_paise: int
    total_recorded_expenses_paise: int
    recorded_balance_paise: int

    total_harvested_grams: int

    # Negative means sales exceed the harvest recorded in the app.
    harvest_minus_sales_grams: int
    sales_exceed_recorded_harvest: bool

    record_count: int
    records: list[SaleRead]
