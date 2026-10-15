import re
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

AreaUnit = Literal["acres", "kanal"]
TaskStatus = Literal["pending", "completed", "skipped", "postponed"]


class AuthCredentials(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
            raise ValueError("Enter a valid email address")
        return normalized


class RegisterRequest(AuthCredentials):
    name: str = Field(min_length=2, max_length=80)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        return value.strip()


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserRead


class CropCycleCreate(BaseModel):
    field_name: str = Field(min_length=1, max_length=80)
    area: float = Field(gt=0, le=100_000)
    area_unit: AreaUnit
    location: str | None = Field(default=None, max_length=120)
    sowing_date: date
    crop: Literal["wheat"] = "wheat"


class FieldRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    area: float
    area_unit: AreaUnit
    location: str | None
    created_at: datetime


class FarmTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    category: str
    due_date: date
    status: TaskStatus


class TaskUpdate(BaseModel):
    status: TaskStatus | None = None
    due_date: date | None = None


class CropCycleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    crop: str
    sowing_date: date
    schedule_source: str
    schedule_version: str
    created_at: datetime
    field: FieldRead
    tasks: list[FarmTaskRead]
