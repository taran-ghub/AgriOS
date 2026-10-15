from datetime import date
from typing import Literal

from pydantic import BaseModel


class TodayTask(BaseModel):
    id: int
    crop_cycle_id: int
    field_name: str
    crop: str
    title: str
    category: str
    due_date: date
    status: Literal["pending", "postponed"]
    schedule_source: str
    schedule_version: str


class TaskGroup(BaseModel):
    total_count: int
    tasks: list[TodayTask]


class TodayOverview(BaseModel):
    on_date: date
    upcoming_through: date
    overdue: TaskGroup
    due_today: TaskGroup
    upcoming: TaskGroup