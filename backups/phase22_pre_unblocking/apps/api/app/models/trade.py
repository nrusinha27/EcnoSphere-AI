"""
Phase 22 — TradeFlow SQLAlchemy Model
======================================
Relational bilateral trade ledger storing verified real-world trade data
from World Bank / UN Comtrade public datasets.

Provides:
  1. Durable persistence of bilateral trade flows independent of Neo4j
  2. Fallback data source when Neo4j is unavailable
  3. Relational join capability with GDP/Country data
  4. Year-filtered queries for timeline replay
"""
from sqlalchemy import Column, String, Integer, Float, BigInteger, DateTime, Index
from sqlalchemy.sql import func
from app.database.base import Base


class TradeFlow(Base):
    """
    Bilateral trade flow record between two sovereign economies.

    Data sources:
      - World Bank Trade Statistics (WITS) API (CC BY 4.0)
      - UN Comtrade 2023 Annual Trade Review (verified bilateral values)
      - IMF Direction of Trade Statistics (DOTS) 2023 Q4

    Note: All monetary values are in USD (not billions).
    """
    __tablename__ = "trade_flows"
    __table_args__ = (
        Index("ix_trade_flows_source_year", "source_iso3", "year"),
        Index("ix_trade_flows_target_year", "target_iso3", "year"),
        Index("ix_trade_flows_pair_year", "source_iso3", "target_iso3", "year"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    # Sovereign ISO 3166-1 alpha-3 identifiers (standardized)
    source_iso3 = Column(String(3), nullable=False, index=True,
                         comment="Exporting country ISO3 code (e.g. USA)")
    target_iso3 = Column(String(3), nullable=False, index=True,
                         comment="Importing country ISO3 code (e.g. CHN)")

    year = Column(Integer, nullable=False, index=True,
                  comment="Reporting year (2015–2025)")

    commodity_category = Column(String(50), nullable=True, default="Total",
                                comment="Commodity grouping (Total, Agriculture, Manufacturing, etc.)")

    # Monetary values in USD
    export_value_usd = Column(Float, nullable=True, default=0.0,
                              comment="Export value in USD (source -> target)")
    import_value_usd = Column(Float, nullable=True, default=0.0,
                              comment="Import value in USD (target -> source, from reporter perspective)")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return (
            f"<TradeFlow {self.source_iso3}→{self.target_iso3} "
            f"({self.year}) exp=${self.export_value_usd:.0f}>"
        )

    @property
    def net_balance_usd(self) -> float:
        """Net trade balance: positive = surplus, negative = deficit."""
        return (self.export_value_usd or 0.0) - (self.import_value_usd or 0.0)

    @property
    def trade_volume_b(self) -> float:
        """Export value in billions USD for display."""
        return (self.export_value_usd or 0.0) / 1e9

    @property
    def dependency_score(self) -> float:
        """Normalized dependency score (0–1) based on export volume."""
        return min(0.99, (self.export_value_usd or 0.0) / 6e11)
