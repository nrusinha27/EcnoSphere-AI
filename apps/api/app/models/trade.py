"""
Phase 22 — TradeFlow SQLAlchemy Model (Workstream C Corrected)
===============================================================
Relational bilateral trade ledger storing verified real-world trade data
from UN Comtrade (UN_COMTRADE_PUBLIC_HS_TOTAL_2022) via the public preview API.

SCHEMA CORRECTIONS (Phase 22 Unblocking Stage):
  - MODEL-1: Float -> Numeric(28, 2) for monetary precision (USD values up to $10T)
  - MODEL-2: Unique constraint on (reporter_iso3, partner_iso3, year,
             flow_direction, source_dataset) enforced at DB level
  - MODEL-3: Separate reporter_iso3/partner_iso3/flow_direction/trade_value_usd
             columns replace the ambiguous source_iso3/target_iso3 dual-pack.
             Each row = one directional observation from one reporter's customs
             declaration.
  - MODEL-4: trade_value_usd is nullable with NO default — NULL means MISSING_DATA,
             not zero. Genuine zero-valued trade must be explicitly recorded as 0.
  - MODEL-5: net_balance_usd raises NotImplementedError. National trade balance
             MUST NOT be calculated from partial bilateral coverage.
  - MODEL-7: flow_direction column makes observation semantics unambiguous.

Observation key:
  (reporter_iso3, partner_iso3, year, flow_direction, source_dataset)
  This is the minimal unique tuple distinguishing an observation across
  datasets, years, and flow directions without conflating mirror records.

DATA GOVERNANCE:
  - Missing observations remain missing (NULL trade_value_usd)
  - Reporter-export and reporter-import perspectives preserved separately
  - NO automatic mirror harmonization
  - Coverage calculated only when a defensible denominator is available
  - National trade balances MUST NOT be computed from partial bilateral coverage
"""
from sqlalchemy import (
    Column, String, Integer, BigInteger, DateTime, Index,
    Numeric, UniqueConstraint, CheckConstraint
)
from sqlalchemy.sql import func
from app.database.base import Base


class TradeFlow(Base):
    """
    Single directional trade observation from one reporter's customs declaration.

    One row = one flow direction (IMPORT, EXPORT, or RE_EXPORT) for one
    reporter-partner pair in one year, from one source dataset.

    Data source:
      - UN Comtrade Database (UNSD), public preview API
      - Dataset identifier: UN_COMTRADE_PUBLIC_HS_TOTAL_2022
      - API endpoint: https://comtradeapi.un.org/public/v1/preview/C/A/HS
      - License: CC BY 4.0 (UNSD Open Data)

    Monetary values:
      - IMPORT flows: CIF value in USD
      - EXPORT flows: FOB value in USD
      - RE_EXPORT flows: FOB value in USD
    """
    __tablename__ = "trade_flows"
    __table_args__ = (
        # Observation uniqueness key (Workstream C: MODEL-2)
        UniqueConstraint(
            "reporter_iso3", "partner_iso3", "year",
            "flow_direction", "source_dataset",
            name="uq_trade_flows_observation_key"
        ),
        # Composite indexes for bilateral pair and year-filtered queries
        Index("ix_trade_flows_source_year", "reporter_iso3", "year"),
        Index("ix_trade_flows_target_year", "partner_iso3", "year"),
        Index("ix_trade_flows_pair_year", "reporter_iso3", "partner_iso3", "year"),
        Index("ix_trade_flows_pair_flow_year", "reporter_iso3", "partner_iso3", "flow_direction", "year"),
        # Flow direction must be a known value
        CheckConstraint(
            "flow_direction IN ('IMPORT', 'EXPORT', 'RE_EXPORT')",
            name="ck_trade_flows_flow_direction"
        ),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    # Reporter perspective: the country filing this customs declaration
    reporter_iso3 = Column(
        String(3), nullable=False, index=True,
        comment="ISO 3166-1 alpha-3 of the country filing this customs declaration"
    )

    # Partner territory (may be a UN M49 aggregate, not always a sovereign ISO3)
    partner_iso3 = Column(
        String(3), nullable=False, index=True,
        comment=(
            "ISO 3166-1 alpha-3 of trading partner, or UN M49 special area code. "
            "Examples: 'WLD'=World, 'ANS'=Areas Not Specified. May not be a sovereign ISO3."
        )
    )

    year = Column(
        Integer, nullable=False, index=True,
        comment="Calendar year of the reporting period (e.g. 2022)"
    )

    # Flow direction -- explicit per observation (Workstream C: MODEL-7)
    flow_direction = Column(
        String(10), nullable=False, index=True,
        comment="Trade flow direction from reporter's perspective: IMPORT | EXPORT | RE_EXPORT"
    )

    # Valuation basis
    valuation_type = Column(
        String(3), nullable=True,
        comment="Valuation: CIF (cost+insurance+freight) for imports; FOB (free on board) for exports"
    )

    # Monetary value in USD -- NULL means MISSING_DATA (Workstream C: MODEL-4)
    # Numeric(28, 2) for exact decimal representation (Workstream C: MODEL-1)
    trade_value_usd = Column(
        Numeric(28, 2), nullable=True,
        comment=(
            "Trade value in USD. NULL = MISSING_DATA (not reported in source). "
            "Genuine zero-valued trade is recorded as 0.00, NOT NULL."
        )
    )

    # Commodity scope
    commodity_scope = Column(
        String(50), nullable=True,
        comment="Commodity scope: 'TOTAL' for all merchandise goods, or HS chapter code"
    )

    # Observation perspective label for full audit trail
    observation_perspective = Column(
        String(30), nullable=True,
        comment="REPORTER_IMPORT or REPORTER_EXPORT -- which perspective this record represents"
    )

    # Source dataset identifier for cross-dataset traceability (Workstream C: MODEL-2)
    source_dataset = Column(
        String(50), nullable=False,
        default="UN_COMTRADE_2022_PREVIEW",
        comment="Source dataset identifier, e.g. UN_COMTRADE_2022_PREVIEW"
    )

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        val = f"${float(self.trade_value_usd):,.0f}" if self.trade_value_usd is not None else "MISSING_DATA"
        return (
            f"<TradeFlow {self.reporter_iso3}->{self.partner_iso3} "
            f"{self.flow_direction} ({self.year}) {val}>"
        )

    # -------------------------------------------------------------------------
    # Backward-compatibility aliases (deprecated -- use reporter_iso3/partner_iso3)
    # -------------------------------------------------------------------------
    @property
    def source_iso3(self) -> str:
        """
        Deprecated backward-compat alias for reporter_iso3.
        Semantics depend on flow_direction -- use reporter_iso3 directly.
        """
        return self.reporter_iso3

    @property
    def target_iso3(self) -> str:
        """
        Deprecated backward-compat alias for partner_iso3.
        Semantics depend on flow_direction -- use partner_iso3 directly.
        """
        return self.partner_iso3

    # -------------------------------------------------------------------------
    # Data-quality properties
    # -------------------------------------------------------------------------
    @property
    def is_missing_data(self) -> bool:
        """True when trade_value_usd is NULL (not reported in source dataset)."""
        return self.trade_value_usd is None

    @property
    def is_genuine_zero(self) -> bool:
        """True when trade_value_usd is explicitly reported as 0 (not missing)."""
        return self.trade_value_usd is not None and self.trade_value_usd == 0

    @property
    def trade_value_billions(self):
        """Trade value in billions USD for display. Returns None for missing data."""
        if self.trade_value_usd is None:
            return None
        return float(self.trade_value_usd) / 1e9

    # -------------------------------------------------------------------------
    # Governance-protected properties
    # -------------------------------------------------------------------------
    @property
    def net_balance_usd(self):
        """
        National trade balance MUST NOT be calculated from a single bilateral
        observation or from partial bilateral coverage.

        To compute a net trade balance correctly:
          1. Aggregate all reporter_iso3 EXPORT observations for a given year
          2. Aggregate all reporter_iso3 IMPORT observations for the same year
          3. Subtract: total_exports - total_imports
          4. Only when ALL reporting partners are accounted for

        This property is intentionally disabled to prevent governance violations.
        (Workstream C: MODEL-5)
        """
        raise NotImplementedError(
            "net_balance_usd is disabled. Computing national trade balance from "
            "individual bilateral observations violates data governance policy. "
            "Only aggregate when full bilateral coverage is confirmed."
        )

    @property
    def dependency_score(self) -> float:
        """
        Normalized dependency score (0-1) based on trade value magnitude.
        Returns 0.0 for missing data. Capped below 1.0.
        """
        if self.trade_value_usd is None:
            return 0.0
        return min(0.99, float(self.trade_value_usd) / 6e11)
