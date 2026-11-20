"""Add trade_flows table with corrected bilateral trade ledger schema for Phase 22

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-10-15 14:30:00.000000

Phase 22 — Real Trade Data Integration (Workstream C Schema Corrections)
Creates the trade_flows relational ledger for verified bilateral trade observations
with authentic source-level provenance from UN Comtrade (UN_COMTRADE_PUBLIC_HS_TOTAL_2022).

Table: trade_flows
  - id                      (BigSerial PK)
  - reporter_iso3           (String 3, indexed)   — country filing customs declaration
  - partner_iso3            (String 3, indexed)   — partner territory or UN M49 code
  - year                    (Integer, indexed)    — reporting calendar year
  - flow_direction          (String 10, indexed)  — IMPORT, EXPORT, RE_EXPORT
  - valuation_type          (String 3)            — CIF (imports) or FOB (exports)
  - trade_value_usd         (Numeric 28, 2)       — exact USD value (NULL = MISSING_DATA)
  - commodity_scope         (String 50)           — TOTAL or HS code
  - observation_perspective (String 30)           — REPORTER_IMPORT or REPORTER_EXPORT
  - source_dataset          (String 50)           — UN_COMTRADE_2022_PREVIEW
  - created_at              (Timestamptz)         — record creation time

Constraints:
  - uq_trade_flows_observation_key: (reporter_iso3, partner_iso3, year, flow_direction, source_dataset)
  - ck_trade_flows_flow_direction: flow_direction IN ('IMPORT', 'EXPORT', 'RE_EXPORT')
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
        sa.Column('reporter_iso3', sa.String(3), nullable=False,
                  comment='ISO 3166-1 alpha-3 of country filing customs declaration'),
        sa.Column('partner_iso3', sa.String(3), nullable=False,
                  comment='ISO 3166-1 alpha-3 or UN M49 special area code of trading partner'),
        sa.Column('year', sa.Integer(), nullable=False,
                  comment='Calendar reporting year (e.g. 2022)'),
        sa.Column('flow_direction', sa.String(10), nullable=False,
                  comment='Trade flow direction: IMPORT | EXPORT | RE_EXPORT'),
        sa.Column('valuation_type', sa.String(3), nullable=True,
                  comment='Valuation basis: CIF for imports, FOB for exports'),
        sa.Column('trade_value_usd', sa.Numeric(28, 2), nullable=True,
                  comment='Trade value in USD. NULL=MISSING_DATA, 0.00=genuine zero'),
        sa.Column('commodity_scope', sa.String(50), nullable=True,
                  comment='Commodity scope: TOTAL or HS code'),
        sa.Column('observation_perspective', sa.String(30), nullable=True,
                  comment='REPORTER_IMPORT or REPORTER_EXPORT'),
        sa.Column('source_dataset', sa.String(50), nullable=False, server_default='UN_COMTRADE_2022_PREVIEW',
                  comment='Source dataset identifier'),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'reporter_iso3', 'partner_iso3', 'year', 'flow_direction', 'source_dataset',
            name='uq_trade_flows_observation_key'
        ),
        sa.CheckConstraint(
            "flow_direction IN ('IMPORT', 'EXPORT', 'RE_EXPORT')",
            name='ck_trade_flows_flow_direction'
        ),
    )

    # Column indexes
    op.create_index('ix_trade_flows_reporter_iso3', 'trade_flows', ['reporter_iso3'])
    op.create_index('ix_trade_flows_partner_iso3', 'trade_flows', ['partner_iso3'])
    op.create_index('ix_trade_flows_year', 'trade_flows', ['year'])
    op.create_index('ix_trade_flows_flow_direction', 'trade_flows', ['flow_direction'])

    # Composite indexes for pair and year queries
    op.create_index('ix_trade_flows_source_year', 'trade_flows', ['reporter_iso3', 'year'])
    op.create_index('ix_trade_flows_target_year', 'trade_flows', ['partner_iso3', 'year'])
    op.create_index('ix_trade_flows_pair_year', 'trade_flows', ['reporter_iso3', 'partner_iso3', 'year'])
    op.create_index('ix_trade_flows_pair_flow_year', 'trade_flows', ['reporter_iso3', 'partner_iso3', 'flow_direction', 'year'])


def downgrade() -> None:
    op.drop_index('ix_trade_flows_pair_flow_year', table_name='trade_flows')
    op.drop_index('ix_trade_flows_pair_year', table_name='trade_flows')
    op.drop_index('ix_trade_flows_target_year', table_name='trade_flows')
    op.drop_index('ix_trade_flows_source_year', table_name='trade_flows')
    op.drop_index('ix_trade_flows_flow_direction', table_name='trade_flows')
    op.drop_index('ix_trade_flows_year', table_name='trade_flows')
    op.drop_index('ix_trade_flows_partner_iso3', table_name='trade_flows')
    op.drop_index('ix_trade_flows_reporter_iso3', table_name='trade_flows')
    op.drop_table('trade_flows')
