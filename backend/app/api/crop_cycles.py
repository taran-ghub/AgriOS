from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.app import models, schemas
from backend.app.dependencies import CurrentUser, DbSession
from backend.app.services.crop_cycles import create_crop_cycle

router = APIRouter(prefix="/api", tags=["crop cycles"])


def _cycle_query(crop_cycle_id: int, owner_id: int):
    return (
        select(models.CropCycle)
        .join(models.CropCycle.field)
        .where(
            models.CropCycle.id == crop_cycle_id,
            models.Field.owner_id == owner_id,
        )
        .options(
            selectinload(models.CropCycle.field),
            selectinload(models.CropCycle.tasks),
        )
    )


@router.post(
    "/crop-cycles",
    response_model=schemas.CropCycleRead,
    status_code=status.HTTP_201_CREATED,
)
def create_cycle(
    payload: schemas.CropCycleCreate,
    session: DbSession,
    current_user: CurrentUser,
):
    crop_cycle = create_crop_cycle(session, payload, current_user)
    return session.scalar(_cycle_query(crop_cycle.id, current_user.id))


@router.get("/crop-cycles", response_model=list[schemas.CropCycleRead])
def list_cycles(session: DbSession, current_user: CurrentUser):
    query = (
        select(models.CropCycle)
        .join(models.CropCycle.field)
        .where(models.Field.owner_id == current_user.id)
        .options(
            selectinload(models.CropCycle.field),
            selectinload(models.CropCycle.tasks),
        )
        .order_by(
            models.CropCycle.created_at.desc(),
            models.CropCycle.id.desc(),
        )
    )
    return session.scalars(query).all()


@router.get("/crop-cycles/{crop_cycle_id}", response_model=schemas.CropCycleRead)
def get_cycle(crop_cycle_id: int, session: DbSession, current_user: CurrentUser):
    crop_cycle = session.scalar(_cycle_query(crop_cycle_id, current_user.id))
    if crop_cycle is None:
        raise HTTPException(status_code=404, detail="Crop cycle not found")
    return crop_cycle


@router.patch("/tasks/{task_id}", response_model=schemas.FarmTaskRead)
def update_task(
    task_id: int,
    payload: schemas.TaskUpdate,
    session: DbSession,
    current_user: CurrentUser,
):
    task = session.scalar(
        select(models.FarmTask)
        .join(models.FarmTask.crop_cycle)
        .join(models.CropCycle.field)
        .where(
            models.FarmTask.id == task_id,
            models.Field.owner_id == current_user.id,
        )
    )
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide a task change")

    for field_name, value in changes.items():
        setattr(task, field_name, value)

    session.commit()
    session.refresh(task)
    return task
