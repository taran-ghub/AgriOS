from decimal import Decimal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from backend.app import models
from backend.app.dependencies import CurrentUser, DbSession
from backend.app.expense_models import Expense
from backend.app.expense_schemas import (
    ExpenseCreate,
    ExpenseOverview,
    ExpenseRead,
)


router = APIRouter(
    prefix="/api/crop-cycles",
    tags=["expenses"],
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
    "/{crop_cycle_id}/expenses",
    response_model=ExpenseOverview,
)
def get_expenses(
    crop_cycle_id: int,
    session: DbSession,
    current_user: CurrentUser,
):
    require_owned_cycle(crop_cycle_id, session, current_user)

    records = session.scalars(
        select(Expense)
        .where(Expense.crop_cycle_id == crop_cycle_id)
        .order_by(
            Expense.expense_date.desc(),
            Expense.id.desc(),
        )
    ).all()

    return ExpenseOverview(
        total_recorded_paise=sum(
            record.amount_paise for record in records
        ),
        record_count=len(records),
        records=[
            ExpenseRead.model_validate(record)
            for record in records
        ],
    )


@router.post(
    "/{crop_cycle_id}/expenses",
    response_model=ExpenseRead,
    status_code=status.HTTP_201_CREATED,
)
def create_expense(
    crop_cycle_id: int,
    payload: ExpenseCreate,
    session: DbSession,
    current_user: CurrentUser,
):
    require_owned_cycle(crop_cycle_id, session, current_user)

    expense = Expense(
        crop_cycle_id=crop_cycle_id,
        expense_date=payload.expense_date,
        category=payload.category,
        amount_paise=int(payload.amount * Decimal("100")),
        notes=payload.notes,
    )

    session.add(expense)
    session.commit()
    session.refresh(expense)

    return expense