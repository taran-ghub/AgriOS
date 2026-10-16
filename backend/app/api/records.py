from typing import Literal

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from backend.app import models
from backend.app.dependencies import CurrentUser, DbSession
from backend.app.expense_models import Expense
from backend.app.harvest_models import HarvestRecord
from backend.app.irrigation_models import IrrigationRecord
from backend.app.sale_models import SaleRecord


router = APIRouter(
    prefix="/api/crop-cycles",
    tags=["record management"],
)

RecordType = Literal[
    "irrigation",
    "expenses",
    "harvests",
    "sales",
]

RECORD_MODELS = {
    "irrigation": IrrigationRecord,
    "expenses": Expense,
    "harvests": HarvestRecord,
    "sales": SaleRecord,
}


@router.delete(
    "/{crop_cycle_id}/records/{record_type}/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_record(
    crop_cycle_id: int,
    record_type: RecordType,
    record_id: int,
    session: DbSession,
    current_user: CurrentUser,
) -> Response:
    # First verify that this crop plan belongs to the account.
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

    # Only these four explicitly supported record types are allowed.
    record_model = RECORD_MODELS[record_type]

    # Also verify that the record belongs to this exact crop plan.
    record = session.scalar(
        select(record_model)
        .where(
            record_model.id == record_id,
            record_model.crop_cycle_id == crop_cycle_id,
        )
    )

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found",
        )

    session.delete(record)
    session.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)