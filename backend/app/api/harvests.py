from decimal import Decimal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from backend.app import models
from backend.app.dependencies import CurrentUser, DbSession
from backend.app.harvest_models import HarvestRecord
from backend.app.harvest_schemas import (
    HarvestCreate,
    HarvestOverview,
    HarvestRead,
)

router = APIRouter(
    prefix="/api/crop-cycles",
    tags=["harvests"],
)

GRAMS_PER_UNIT = {
    "kg": Decimal(1000),
    "quintal": Decimal(100000),
}


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
    "/{crop_cycle_id}/harvests",
    response_model=HarvestOverview,
)
def get_harvests(
    crop_cycle_id: int,
    session: DbSession,
    current_user: CurrentUser,
):
    require_owned_cycle(crop_cycle_id, session, current_user)

    records = session.scalars(
        select(HarvestRecord)
        .where(HarvestRecord.crop_cycle_id == crop_cycle_id)
        .order_by(
            HarvestRecord.harvest_date.desc(),
            HarvestRecord.id.desc(),
        )
    ).all()

    return HarvestOverview(
        total_recorded_grams=sum(record.quantity_grams for record in records),
        record_count=len(records),
        records=[HarvestRead.model_validate(record) for record in records],
    )


@router.post(
    "/{crop_cycle_id}/harvests",
    response_model=HarvestRead,
    status_code=status.HTTP_201_CREATED,
)
def create_harvest(
    crop_cycle_id: int,
    payload: HarvestCreate,
    session: DbSession,
    current_user: CurrentUser,
):
    crop_cycle = require_owned_cycle(
        crop_cycle_id,
        session,
        current_user,
    )

    if payload.harvest_date < crop_cycle.sowing_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Harvest date cannot be before the sowing date",
        )

    quantity_grams = int(payload.quantity * GRAMS_PER_UNIT[payload.unit])

    record = HarvestRecord(
        crop_cycle_id=crop_cycle_id,
        harvest_date=payload.harvest_date,
        quantity_grams=quantity_grams,
        notes=payload.notes,
    )

    session.add(record)
    session.commit()
    session.refresh(record)

    return record
