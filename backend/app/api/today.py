from datetime import date, timedelta

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from backend.app import models
from backend.app.dependencies import CurrentUser, DbSession
from backend.app.today_schemas import (
    TaskGroup,
    TodayOverview,
    TodayTask,
)

router = APIRouter(
    prefix="/api",
    tags=["today"],
)

TASKS_PER_GROUP = 20


@router.get("/today", response_model=TodayOverview)
def get_today(
    on_date: date,
    session: DbSession,
    current_user: CurrentUser,
):
    # The frontend supplies the user's local date.
    try:
        upcoming_through = on_date + timedelta(days=7)
    except OverflowError:
        raise HTTPException(
            status_code=422,
            detail="Date is outside the supported range",
        )

    base_filters = (
        models.Field.owner_id == current_user.id,
        models.FarmTask.status.in_(("pending", "postponed")),
    )

    def read_group(*date_filters) -> TaskGroup:
        total_count = session.scalar(
            select(func.count(models.FarmTask.id))
            .select_from(models.FarmTask)
            .join(models.FarmTask.crop_cycle)
            .join(models.CropCycle.field)
            .where(*base_filters, *date_filters)
        )

        rows = session.execute(
            select(
                models.FarmTask,
                models.CropCycle,
                models.Field,
            )
            .select_from(models.FarmTask)
            .join(models.FarmTask.crop_cycle)
            .join(models.CropCycle.field)
            .where(*base_filters, *date_filters)
            .order_by(
                models.FarmTask.due_date,
                models.FarmTask.id,
            )
            .limit(TASKS_PER_GROUP)
        ).all()

        tasks = [
            TodayTask(
                id=task.id,
                crop_cycle_id=cycle.id,
                field_name=field.name,
                crop=cycle.crop,
                title=task.title,
                category=task.category,
                due_date=task.due_date,
                status=task.status,
                schedule_source=cycle.schedule_source,
                schedule_version=cycle.schedule_version,
            )
            for task, cycle, field in rows
        ]

        return TaskGroup(
            total_count=int(total_count or 0),
            tasks=tasks,
        )

    return TodayOverview(
        on_date=on_date,
        upcoming_through=upcoming_through,
        overdue=read_group(
            models.FarmTask.due_date < on_date,
        ),
        due_today=read_group(
            models.FarmTask.due_date == on_date,
        ),
        upcoming=read_group(
            models.FarmTask.due_date > on_date,
            models.FarmTask.due_date <= upcoming_through,
        ),
    )
