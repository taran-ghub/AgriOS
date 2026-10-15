from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


ExpenseCategory = Literal[
    "seeds",
    "fertiliser",
    "crop_protection",
    "irrigation",
    "labour",
    "machinery",
    "transport",
    "other",
]


class ExpenseCreate(BaseModel):
    expense_date: date
    category: ExpenseCategory

    # Input is in rupees. Accept at most two decimal places.
    amount: Decimal = Field(
        gt=0,
        le=Decimal("10000000"),
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


class ExpenseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    crop_cycle_id: int
    expense_date: date
    category: ExpenseCategory
    amount_paise: int
    notes: str | None
    created_at: datetime


class ExpenseOverview(BaseModel):
    currency: Literal["INR"] = "INR"
    total_recorded_paise: int
    record_count: int
    records: list[ExpenseRead]