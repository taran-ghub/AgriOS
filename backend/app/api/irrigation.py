from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from backend.app import models
from backend.app.dependencies import CurrentUser, DbSession
from backend.app.irrigation_models import IrrigationRecord
from backend.app.irrigation_schemas import (
    IrrigationCreate,
    IrrigationRead,
)

router = APIRouter(
    prefix="/api/crop-cycles",
    tags=["irrigation"],
)


def require_owned_cycle(
    crop_cycle_id: int,
    session: DbSession,
    current_user: CurrentUser,
) -> models.CropCycle:
    crop_cycle = session.scalar(
        select(models.CropCycle)
        .join(models.CropCycle.field)
        .where(
            models.CropCycle.id == crop_cycle_id,
            models.Field.owner_id == current_user.id,
        )
    )

    if crop_cycle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Crop cycle not found",
        )

    return crop_cycle


@router.get(
    "/{crop_cycle_id}/irrigation",
    response_model=list[IrrigationRead],
)
def list_irrigation_records(
    crop_cycle_id: int,
    session: DbSession,
    current_user: CurrentUser,
):
    require_owned_cycle(crop_cycle_id, session, current_user)

    query = (
        select(IrrigationRecord)
        .where(IrrigationRecord.crop_cycle_id == crop_cycle_id)
        .order_by(
            IrrigationRecord.irrigation_date.desc(),
            IrrigationRecord.id.desc(),
        )
    )

    return session.scalars(query).all()


@router.post(
    "/{crop_cycle_id}/irrigation",
    response_model=IrrigationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_irrigation_record(
    crop_cycle_id: int,
    payload: IrrigationCreate,
    session: DbSession,
    current_user: CurrentUser,
):
    require_owned_cycle(crop_cycle_id, session, current_user)

    record = IrrigationRecord(
        crop_cycle_id=crop_cycle_id,
        irrigation_date=payload.irrigation_date,
        method=payload.method,
        notes=payload.notes,
    )

    session.add(record)
    session.commit()
    session.refresh(record)

    return record
