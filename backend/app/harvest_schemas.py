from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


HarvestUnit = Literal["kg", "quintal"]


class HarvestCreate(BaseModel):
    harvest_date: date

    quantity: Decimal = Field(
        gt=0,
        le=Decimal("1000000"),
        max_digits=10,
        decimal_places=3,
        allow_inf_nan=False,
    )

    unit: HarvestUnit = "kg"

    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("notes", mode="before")
    @classmethod
    def clean_notes(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value


class HarvestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    crop_cycle_id: int
    harvest_date: date
    quantity_grams: int
    notes: str | None
    created_at: datetime


class HarvestOverview(BaseModel):
    total_recorded_grams: int
    record_count: int
    records: list[HarvestRead]