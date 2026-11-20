"""Add trade_flows table with bilateral trade ledger for Phase 22

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-10-15 14:30:00.000000

Phase 22 — Real Trade Data Integration
Creates the trade_flows relational ledger for verified bilateral trade data
from World Bank / UN Comtrade public datasets.

Table: trade_flows
  - id              (BigSerial PK)
  - source_iso3     (Char 3, indexed)   — exporting country
  - target_iso3     (Char 3, indexed)   — importing country
  - year            (Integer, indexed)  — reporting year
  - commodity_category (Varchar 50)     — trade category grouping
  - export_value_usd   (Float)         — exports in USD
  - import_value_usd   (Float)         — imports in USD
  - created_at         (Timestamptz)   — record creation time

Indexes:
  - ix_trade_flows_source_year  (source_iso3, year)
  - ix_trade_flows_target_year  (target_iso3, year)
  - ix_trade_flows_pair_year    (source_iso3, target_iso3, year)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'trade_flows',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('source_iso3', sa.String(3), nullable=False,
                  comment='Exporting country ISO3 code (e.g. USA)'),
        sa.Column('target_iso3', sa.String(3), nullable=False,
                  comment='Importing country ISO3 code (e.g. CHN)'),
        sa.Column('year', sa.Integer(), nullable=False,
                  comment='Reporting year (2015-2025)'),
        sa.Column('commodity_category', sa.String(50), nullable=True,
                  comment='Commodity grouping (Total, Agriculture, Manufacturing, etc.)'),
        sa.Column('export_value_usd', sa.Float(), nullable=True,
                  comment='Export value in USD (source -> target)'),
        sa.Column('import_value_usd', sa.Float(), nullable=True,
                  comment='Import value in USD (target -> source, reporter perspective)'),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False
        ),
        sa.PrimaryKeyConstraint('id')
    )

    # Individual column indexes for single-key lookups
    op.create_index('ix_trade_flows_source_iso3', 'trade_flows', ['source_iso3'])
    op.create_index('ix_trade_flows_target_iso3', 'trade_flows', ['target_iso3'])
    op.create_index('ix_trade_flows_year', 'trade_flows', ['year'])

    # Composite indexes for bilateral pair and year-filtered queries
    op.create_index('ix_trade_flows_source_year', 'trade_flows', ['source_iso3', 'year'])
    op.create_index('ix_trade_flows_target_year', 'trade_flows', ['target_iso3', 'year'])
    op.create_index('ix_trade_flows_pair_year', 'trade_flows', ['source_iso3', 'target_iso3', 'year'])


def downgrade() -> None:
    op.drop_index('ix_trade_flows_pair_year', table_name='trade_flows')
    op.drop_index('ix_trade_flows_target_year', table_name='trade_flows')
    op.drop_index('ix_trade_flows_source_year', table_name='trade_flows')
    op.drop_index('ix_trade_flows_year', table_name='trade_flows')
    op.drop_index('ix_trade_flows_target_iso3', table_name='trade_flows')
    op.drop_index('ix_trade_flows_source_iso3', table_name='trade_flows')
    op.drop_table('trade_flows')
