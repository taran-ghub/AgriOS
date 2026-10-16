import os
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


DEFAULT_DATABASE_PATH = (
    Path(__file__).resolve().parents[1] / "agrios.db"
)

DEFAULT_DATABASE_URL = (
    f"sqlite:///{DEFAULT_DATABASE_PATH.as_posix()}"
)

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    DEFAULT_DATABASE_URL,
)

# Some hosting providers supply the older postgres:// prefix.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://",
        "postgresql+psycopg://",
        1,
    )
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgresql://",
        "postgresql+psycopg://",
        1,
    )

database_config = make_url(DATABASE_URL)
is_sqlite = database_config.get_backend_name() == "sqlite"


class Base(DeclarativeBase):
    pass


engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if is_sqlite else {},
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
)


if is_sqlite:

    @event.listens_for(engine, "connect")
    def enable_sqlite_foreign_keys(connection, _) -> None:
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def create_tables() -> None:
    # Import every model so all tables are registered before creation.
    from backend.app import models  # noqa: F401
    from backend.app import expense_models  # noqa: F401
    from backend.app import harvest_models  # noqa: F401
    from backend.app import irrigation_models  # noqa: F401
    from backend.app import sale_models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session