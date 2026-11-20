"""
Phase 22 — PostgreSQL Trade Ledger Ingestion Script
=====================================================
Idempotently loads authentic bilateral trade observations from the staged
UN Comtrade CSV into the `trade_flows` relational table.

Enforces:
  - Numeric(28, 2) decimal precision for monetary amounts
  - Explicit missing-value semantics (NULL for missing, 0.00 for genuine zero)
  - Database-level unique constraint on (reporter_iso3, partner_iso3, year, flow_direction, source_dataset)
  - Check constraint on flow_direction ('IMPORT', 'EXPORT', 'RE_EXPORT')
  - Strict database safety: fails closed if target is the active production DB
    without explicit authorization.

Usage:
  # Isolated test database ingestion (default):
  python apps/api/scripts/ingest_trade_flows_db.py --db-name econosphere_migration_test

  # Dry run:
  python apps/api/scripts/ingest_trade_flows_db.py --dry-run
"""
import asyncio
import argparse
import sys
import os
import csv
from decimal import Decimal
from pathlib import Path
import asyncpg

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CSV = PROJECT_ROOT / "data" / "raw" / "trade" / "staged_trade_observations_2022.csv"
ACTIVE_PRODUCTION_DB = "econosphere"
DEFAULT_TEST_DB = "econosphere_migration_test"


async def ingest_trade_flows(
    db_name: str,
    csv_path: Path,
    db_user: str = "postgres",
    db_pass: str = "Mane@123",
    db_host: str = "localhost",
    db_port: int = 5432,
    allow_production: bool = False,
    dry_run: bool = False,
) -> dict:
    # 1. Safety Guard against accidental production mutation
    if db_name == ACTIVE_PRODUCTION_DB and not allow_production:
        raise RuntimeError(
            f"GOVERNANCE ENFORCEMENT: Direct ingestion into active production "
            f"database '{ACTIVE_PRODUCTION_DB}' is blocked. Pass --allow-production "
            f"only when explicitly authorized."
        )

    if not csv_path.exists():
        raise FileNotFoundError(f"Staged CSV not found at: {csv_path}")

    # 2. Read and parse CSV observations
    rows_to_insert = []
    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            val_str = r.get("trade_value_usd")
            val_decimal = Decimal(val_str) if (val_str is not None and val_str.strip() != "") else None

            rows_to_insert.append((
                r["reporter_iso3"].strip().upper(),
                r["partner_iso3"].strip().upper(),
                int(r["reporting_year"]),
                r["flow_direction"].strip().upper(),
                r.get("valuation_type", "").strip().upper() or None,
                val_decimal,
                r.get("commodity_scope", "TOTAL").strip() or "TOTAL",
                r.get("observation_perspective", "").strip() or None,
                r.get("source_dataset", "UN_COMTRADE_2022_PREVIEW").strip(),
            ))

    total_records = len(rows_to_insert)
    if dry_run:
        print(f"[DRY RUN] Parsed {total_records} records from {csv_path.name}. No changes committed.")
        return {"total": total_records, "inserted": 0, "status": "DRY_RUN"}

    # 3. Connect to target database
    conn = await asyncpg.connect(
        user=db_user,
        password=db_pass,
        host=db_host,
        port=db_port,
        database=db_name,
    )

    try:
        # Verify database identity
        actual_db = await conn.fetchval("SELECT current_database()")
        if actual_db == ACTIVE_PRODUCTION_DB and not allow_production:
            raise RuntimeError(f"Connected database is '{actual_db}'. Aborting!")

        initial_count = await conn.fetchval("SELECT count(*) FROM trade_flows")
        print(f"Connected to '{actual_db}'. Initial trade_flows row count: {initial_count}")

        # 4. Execute idempotent batch insert using ON CONFLICT DO NOTHING
        insert_sql = """
            INSERT INTO trade_flows (
                reporter_iso3,
                partner_iso3,
                year,
                flow_direction,
                valuation_type,
                trade_value_usd,
                commodity_scope,
                observation_perspective,
                source_dataset
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (reporter_iso3, partner_iso3, year, flow_direction, source_dataset)
            DO NOTHING
        """

        async with conn.transaction():
            await conn.executemany(insert_sql, rows_to_insert)

        final_count = await conn.fetchval("SELECT count(*) FROM trade_flows")
        inserted = final_count - initial_count
        print(f"Ingestion complete. Rows inserted: {inserted}. Final trade_flows row count: {final_count}")

        return {
            "initial_count": initial_count,
            "final_count": final_count,
            "inserted": inserted,
            "total_parsed": total_records,
            "status": "SUCCESS",
        }

    finally:
        await conn.close()


def main():
    parser = argparse.ArgumentParser(description="Ingest staged UN Comtrade observations into PostgreSQL")
    parser.add_argument("--db-name", default=DEFAULT_TEST_DB, help="Target PostgreSQL database name")
    parser.add_argument("--csv-path", default=str(DEFAULT_CSV), help="Path to staged CSV")
    parser.add_argument("--allow-production", action="store_true", help="Explicit override for active DB")
    parser.add_argument("--dry-run", action="store_true", help="Parse and validate without inserting")
    args = parser.parse_args()

    asyncio.run(ingest_trade_flows(
        db_name=args.db_name,
        csv_path=Path(args.csv_path),
        allow_production=args.allow_production,
        dry_run=args.dry_run,
    ))


if __name__ == "__main__":
    main()
