from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


class HarvestRecord(Base):
    __tablename__ = "harvest_records"

    __table_args__ = (
        CheckConstraint(
            "quantity_grams > 0",
            name="harvest_quantity_positive",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    crop_cycle_id: Mapped[int] = mapped_column(
        ForeignKey("crop_cycles.id", ondelete="CASCADE"),
        index=True,
    )

    harvest_date: Mapped[date] = mapped_column(Date)

    quantity_grams: Mapped[int] = mapped_column(Integer)

    notes: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )