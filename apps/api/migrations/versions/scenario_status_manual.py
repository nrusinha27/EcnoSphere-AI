"""Add scenariostatus enum and scenarios.status column

Revision ID: scenario_status_manual
Revises: e1161522f790
Create Date: 2026-07-23 00:00:00.000000

Workstream C correction (Phase 22 Unblocking Stage):
The original migration was an empty stub. The active production database had
the `status` column applied manually (out of band), which caused the migration
chain to fail on a fresh PostgreSQL install when `b2c3d4e5f6a7_add_trade_indexes`
attempted to create `ix_scenarios_status` on a non-existent column.

This correction implements the DDL that was applied manually so the migration
chain is fully reproducible. Guards with IF NOT EXISTS / conditional checks
ensure this is idempotent if run against the active database (which already
has the column from the manual operation).

Active DB state confirmed: scenariostatus enum = {DRAFT, PUBLISHED, ARCHIVED},
scenarios.status NOT NULL DEFAULT 'DRAFT'::scenariostatus.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'scenario_status_manual'
down_revision: Union[str, Sequence[str], None] = 'e1161522f790'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add scenariostatus enum type and scenarios.status column (idempotent)."""
    # Create enum type if not already present (guard for active DB re-apply)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scenariostatus') THEN
                CREATE TYPE scenariostatus AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
            END IF;
        END
        $$;
    """)

    # Add status column if not already present (guard for active DB re-apply)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'scenarios' AND column_name = 'status'
            ) THEN
                ALTER TABLE scenarios
                    ADD COLUMN status scenariostatus NOT NULL DEFAULT 'DRAFT'::scenariostatus;
            END IF;
        END
        $$;
    """)


def downgrade() -> None:
    """Remove scenarios.status column and scenariostatus enum type."""
    # Drop column first (dependent objects must be removed before type)
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'scenarios' AND column_name = 'status'
            ) THEN
                ALTER TABLE scenarios DROP COLUMN status;
            END IF;
        END
        $$;
    """)

    # Drop enum type if no other table references it
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scenariostatus') THEN
                DROP TYPE scenariostatus;
            END IF;
        END
        $$;
    """)
