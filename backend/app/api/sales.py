from decimal import Decimal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from backend.app import models
from backend.app.dependencies import CurrentUser, DbSession
from backend.app.expense_models import Expense
from backend.app.harvest_models import HarvestRecord
from backend.app.sale_models import SaleRecord
from backend.app.sale_schemas import (
    SaleCreate,
    SaleRead,
    SalesOverview,
)

router = APIRouter(
    prefix="/api/crop-cycles",
    tags=["sales"],
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
    "/{crop_cycle_id}/sales",
    response_model=SalesOverview,
)
def get_sales(
    crop_cycle_id: int,
    session: DbSession,
    current_user: CurrentUser,
):
    require_owned_cycle(crop_cycle_id, session, current_user)

    records = session.scalars(
        select(SaleRecord)
        .where(SaleRecord.crop_cycle_id == crop_cycle_id)
        .order_by(
            SaleRecord.sale_date.desc(),
            SaleRecord.id.desc(),
        )
    ).all()

    expenses = session.scalar(
        select(func.coalesce(func.sum(Expense.amount_paise), 0)).where(
            Expense.crop_cycle_id == crop_cycle_id
        )
    )

    harvested = session.scalar(
        select(
            func.coalesce(
                func.sum(HarvestRecord.quantity_grams),
                0,
            )
        ).where(HarvestRecord.crop_cycle_id == crop_cycle_id)
    )

    total_expenses = int(expenses or 0)
    total_harvested = int(harvested or 0)

    total_sold = sum(record.quantity_grams for record in records)
    total_value = sum(record.total_value_paise for record in records)

    return SalesOverview(
        total_sold_grams=total_sold,
        total_sales_value_paise=total_value,
        total_recorded_expenses_paise=total_expenses,
        recorded_balance_paise=total_value - total_expenses,
        total_harvested_grams=total_harvested,
        harvest_minus_sales_grams=total_harvested - total_sold,
        sales_exceed_recorded_harvest=total_sold > total_harvested,
        record_count=len(records),
        records=[SaleRead.model_validate(record) for record in records],
    )


@router.post(
    "/{crop_cycle_id}/sales",
    response_model=SaleRead,
    status_code=status.HTTP_201_CREATED,
)
def create_sale(
    crop_cycle_id: int,
    payload: SaleCreate,
    session: DbSession,
    current_user: CurrentUser,
):
    crop_cycle = require_owned_cycle(
        crop_cycle_id,
        session,
        current_user,
    )

    if payload.sale_date < crop_cycle.sowing_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Sale date cannot be before the sowing date",
        )

    record = SaleRecord(
        crop_cycle_id=crop_cycle_id,
        sale_date=payload.sale_date,
        quantity_grams=int(payload.quantity * GRAMS_PER_UNIT[payload.unit]),
        total_value_paise=int(payload.total_value * Decimal(100)),
        notes=payload.notes,
    )

    session.add(record)
    session.commit()
    session.refresh(record)

    return record
