from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

IrrigationMethod = Literal[
    "flood",
    "furrow",
    "sprinkler",
    "drip",
    "other",
]


class IrrigationCreate(BaseModel):
    irrigation_date: date
    method: IrrigationMethod
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("notes", mode="before")
    @classmethod
    def clean_notes(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value


class IrrigationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    crop_cycle_id: int
    irrigation_date: date
    method: IrrigationMethod
    notes: str | None
    created_at: datetime
