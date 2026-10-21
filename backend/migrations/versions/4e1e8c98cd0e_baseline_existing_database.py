"""baseline existing database

Revision ID: 4e1e8c98cd0e
Revises:
Create Date: 2026-10-21 17:42:50.391025

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "4e1e8c98cd0e"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""


def downgrade() -> None:
    """Downgrade schema."""
