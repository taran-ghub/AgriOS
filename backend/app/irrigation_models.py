from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


class IrrigationRecord(Base):
    __tablename__ = "irrigation_records"

    id: Mapped[int] = mapped_column(primary_key=True)

    crop_cycle_id: Mapped[int] = mapped_column(
        ForeignKey("crop_cycles.id", ondelete="CASCADE"),
        index=True,
    )

    irrigation_date: Mapped[date] = mapped_column(Date)
    method: Mapped[str] = mapped_column(String(30))
    notes: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
