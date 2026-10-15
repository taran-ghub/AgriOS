from datetime import timedelta

from sqlalchemy.orm import Session

from backend.app import models, schemas

# Development-only sample data. Replace this with a reviewed, versioned schedule
# before presenting the tasks as agricultural recommendations.
SAMPLE_WHEAT_SCHEDULE = (
    ("Prepare the field", "preparation", -14),
    ("Confirm seed and supplies", "preparation", -7),
    ("Record sowing", "sowing", 0),
    ("Review first irrigation", "irrigation", 21),
    ("Check crop condition", "monitoring", 35),
    ("Review second irrigation", "irrigation", 45),
    ("Review crop nutrition", "nutrition", 60),
    ("Check harvest readiness", "harvest", 140),
)

SAMPLE_SOURCE = "Development sample - not agronomic advice"
SAMPLE_VERSION = "sample-wheat-v1"


def create_crop_cycle(
    session: Session, payload: schemas.CropCycleCreate, owner: models.User
) -> models.CropCycle:
    field = models.Field(
        owner=owner,
        name=payload.field_name.strip(),
        area=payload.area,
        area_unit=payload.area_unit,
        location=payload.location.strip() if payload.location else None,
    )
    crop_cycle = models.CropCycle(
        field=field,
        crop=payload.crop,
        sowing_date=payload.sowing_date,
        schedule_source=SAMPLE_SOURCE,
        schedule_version=SAMPLE_VERSION,
    )
    crop_cycle.tasks = [
        models.FarmTask(
            title=title,
            category=category,
            due_date=payload.sowing_date + timedelta(days=offset_days),
        )
        for title, category, offset_days in SAMPLE_WHEAT_SCHEDULE
    ]
    session.add(crop_cycle)
    session.commit()
    session.refresh(crop_cycle)
    return crop_cycle
