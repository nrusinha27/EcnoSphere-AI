"""
Phase 22 — Neo4j Trade Graph Seeder (Authentic Data)
=====================================================
Populates the Neo4j knowledge graph from verified bilateral trade observations
originating from UN Comtrade (UN_COMTRADE_PUBLIC_HS_TOTAL_2022).

Key Features:
  - Stable ISO3 identifiers throughout (never Neo4j internal element IDs)
  - Zero random numbers or synthetic interpolations
  - Idempotent UNWIND batching for high performance and duplicate prevention
  - Preserves reporting perspectives (EXPORTER_FOB, IMPORTER_CIF)
  - Filters non-country aggregate territories (WLD, ANS, etc.)
  - Synchronizes the offline fallback snapshot `data/processed/cached_network.json`

Usage:
  python apps/api/scripts/seed_neo4j_trade.py --from-db econosphere_migration_test
  python apps/api/scripts/seed_neo4j_trade.py --from-csv data/raw/trade/staged_trade_observations_2022.csv
  python apps/api/scripts/seed_neo4j_trade.py --dry-run
"""
import asyncio
import sys
import os
import csv
import json
import argparse
from pathlib import Path
from collections import defaultdict
from decimal import Decimal
import asyncpg
from neo4j import AsyncGraphDatabase

# Ensure the app module can be imported
sys.path.append(str(Path(__file__).parent.parent))

from app.neo4j.session import neo4j_conn
from app.core.config import settings
import structlog

logger = structlog.get_logger()

PROJECT_ROOT = Path(__file__).resolve().parents[3]
CACHE_FILE = PROJECT_ROOT / "data" / "processed" / "cached_network.json"
DEFAULT_CSV = PROJECT_ROOT / "data" / "raw" / "trade" / "staged_trade_observations_2022.csv"

NON_COUNTRY_CODES = {"WLD", "ANS", "EU27", "UNS", "OAS", "EUR", "AME", "ASI", "AFR", "OCE"}

COUNTRY_NAMES = {
    "USA": "United States", "CHN": "China", "DEU": "Germany", "JPN": "Japan",
    "IND": "India", "GBR": "United Kingdom", "FRA": "France", "BRA": "Brazil",
    "ITA": "Italy", "CAN": "Canada", "KOR": "South Korea", "AUS": "Australia",
    "MEX": "Mexico", "ESP": "Spain", "NLD": "Netherlands", "SAU": "Saudi Arabia",
    "CHE": "Switzerland", "SGP": "Singapore", "IDN": "Indonesia", "TUR": "Turkey",
    "RUS": "Russia", "ARG": "Argentina", "POL": "Poland", "BEL": "Belgium",
    "SWE": "Sweden", "NOR": "Norway", "AUT": "Austria", "UAE": "United Arab Emirates",
    "ZAF": "South Africa", "MYS": "Malaysia", "THA": "Thailand", "PHL": "Philippines",
    "VNM": "Vietnam", "EGY": "Egypt", "IRN": "Iran", "COL": "Colombia",
    "CHL": "Chile", "DNK": "Denmark", "FIN": "Finland", "PRT": "Portugal",
    "IRL": "Ireland", "CZE": "Czech Republic", "GRC": "Greece", "HUN": "Hungary",
    "ROU": "Romania", "NZL": "New Zealand", "ISR": "Israel", "PAK": "Pakistan",
    "BGD": "Bangladesh", "NGA": "Nigeria", "KWT": "Kuwait", "QAT": "Qatar"
}


def load_corridors_from_csv(csv_path: Path, year_filter: int = None) -> tuple[dict, set]:
    corridors = defaultdict(lambda: {
        "export_value_usd": 0.0,
        "import_value_usd": 0.0,
        "perspectives": set(),
        "source_dataset": "UN_COMTRADE_2022_PREVIEW"
    })

    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rep = r["reporter_iso3"].strip().upper()
            part = r["partner_iso3"].strip().upper()
            flow = r["flow_direction"].strip().upper()
            yr = int(r["reporting_year"])
            source = r.get("source_dataset", "UN_COMTRADE_2022_PREVIEW")

            if year_filter and yr != year_filter:
                continue
            if part in NON_COUNTRY_CODES or rep in NON_COUNTRY_CODES or len(part) != 3 or len(rep) != 3:
                continue

            val_str = r.get("trade_value_usd")
            val = float(val_str) if val_str and val_str.strip() else 0.0
            if val <= 0:
                continue

            if flow == "EXPORT":
                k = (rep, part, yr)
                corridors[k]["export_value_usd"] = val
                corridors[k]["perspectives"].add("EXPORTER_FOB")
                corridors[k]["source_dataset"] = source
            elif flow == "IMPORT":
                k = (part, rep, yr)
                corridors[k]["import_value_usd"] = val
                corridors[k]["perspectives"].add("IMPORTER_CIF")
                corridors[k]["source_dataset"] = source

    country_iso3s = set()
    for (src, tgt, _) in corridors:
        country_iso3s.add(src)
        country_iso3s.add(tgt)

    return dict(corridors), country_iso3s


async def load_corridors_from_postgres(db_name: str, year_filter: int = None) -> tuple[dict, set]:
    conn = await asyncpg.connect(
        user="postgres", password="Mane@123", host="localhost", port=5432, database=db_name
    )
    records = await conn.fetch("""
        SELECT reporter_iso3, partner_iso3, year, flow_direction, valuation_type, trade_value_usd, source_dataset
        FROM trade_flows
        WHERE trade_value_usd IS NOT NULL AND trade_value_usd > 0
    """)
    await conn.close()

    corridors = defaultdict(lambda: {
        "export_value_usd": 0.0,
        "import_value_usd": 0.0,
        "perspectives": set(),
        "source_dataset": "UN_COMTRADE_2022_PREVIEW"
    })

    for r in records:
        rep = r["reporter_iso3"].strip().upper()
        part = r["partner_iso3"].strip().upper()
        flow = r["flow_direction"].strip().upper()
        yr = r["year"]
        source = r["source_dataset"]

        if year_filter and yr != year_filter:
            continue
        if part in NON_COUNTRY_CODES or rep in NON_COUNTRY_CODES or len(part) != 3 or len(rep) != 3:
            continue

        val = float(r["trade_value_usd"])
        if val <= 0:
            continue

        if flow == "EXPORT":
            k = (rep, part, yr)
            corridors[k]["export_value_usd"] = val
            corridors[k]["perspectives"].add("EXPORTER_FOB")
            corridors[k]["source_dataset"] = source
        elif flow == "IMPORT":
            k = (part, rep, yr)
            corridors[k]["import_value_usd"] = val
            corridors[k]["perspectives"].add("IMPORTER_CIF")
            corridors[k]["source_dataset"] = source

    country_iso3s = set()
    for (src, tgt, _) in corridors:
        country_iso3s.add(src)
        country_iso3s.add(tgt)

    return dict(corridors), country_iso3s


async def seed_neo4j(
    corridors: dict,
    country_iso3s: set,
    neo4j_uri: str = "bolt://localhost:7687",
    neo4j_user: str = "neo4j",
    neo4j_pass: str = "password",
    update_cache: bool = True
):
    driver = AsyncGraphDatabase.driver(neo4j_uri, auth=(neo4j_user, neo4j_pass))

    async with driver.session() as s:
        # 1. Clear previous graph
        await s.run("MATCH (n) DETACH DELETE n")

        # 2. Create Country nodes via UNWIND
        country_batch = [
            {"iso3": iso3, "name": COUNTRY_NAMES.get(iso3, iso3)}
            for iso3 in sorted(country_iso3s)
        ]
        await s.run("""
            UNWIND $batch AS c
            MERGE (n:Country {iso3: c.iso3})
            SET n.id = c.iso3,
                n.name = c.name,
                n.label = c.name
        """, batch=country_batch)

        # 3. Batch insert EXPORTS_TO edges
        edge_data = []
        for (src, tgt, yr), c_data in corridors.items():
            exp_usd = c_data["export_value_usd"]
            imp_usd = c_data["import_value_usd"]
            vol_usd = exp_usd if exp_usd > 0 else imp_usd
            vol_b = round(vol_usd / 1e9, 3)
            persp = "_".join(sorted(c_data["perspectives"]))

            edge_data.append({
                "src": src,
                "tgt": tgt,
                "year": yr,
                "tradeVolume": vol_b,
                "exp_usd": exp_usd,
                "imp_usd": imp_usd,
                "perspective": persp,
                "source": c_data["source_dataset"],
                "scope": "TOTAL"
            })

        batch_size = 1000
        for i in range(0, len(edge_data), batch_size):
            chunk = edge_data[i:i + batch_size]
            await s.run("""
                UNWIND $batch AS e
                MATCH (s:Country {iso3: e.src}), (t:Country {iso3: e.tgt})
                MERGE (s)-[r:EXPORTS_TO {year: e.year}]->(t)
                SET r.tradeVolume = e.tradeVolume,
                    r.export_value_usd = e.exp_usd,
                    r.import_value_usd = e.imp_usd,
                    r.perspective = e.perspective,
                    r.source = e.source,
                    r.commodity_scope = e.scope
            """, batch=chunk)

        # Verification query
        res_nodes = await s.run("MATCH (n:Country) RETURN count(n) as cnt")
        n_cnt = (await res_nodes.single())["cnt"]
        res_edges = await s.run("MATCH ()-[r:EXPORTS_TO]->() RETURN count(r) as cnt")
        e_cnt = (await res_edges.single())["cnt"]

        print(f"Neo4j State: {n_cnt} Country nodes, {e_cnt} EXPORTS_TO relationships.")

        # 4. Synchronize offline fallback cache
        if update_cache:
            c_nodes = await s.run("MATCH (c:Country) RETURN c.iso3 as id, c.name as name ORDER BY c.iso3")
            nodes_list = [{"id": r["id"], "label": r["name"], "properties": {"iso3": r["id"], "name": r["name"]}} async for r in c_nodes]
            c_edges = await s.run("""
                MATCH (s:Country)-[r:EXPORTS_TO]->(t:Country)
                RETURN s.iso3 as source, t.iso3 as target, r.year as year, r.tradeVolume as tradeVolume,
                       r.export_value_usd as exp_usd, r.import_value_usd as imp_usd, r.perspective as persp
                ORDER BY s.iso3, t.iso3
            """)
            edges_list = [
                {
                    "id": f"{r['source']}-{r['target']}-{r['year']}",
                    "source": r["source"],
                    "target": r["target"],
                    "type": "EXPORTS_TO",
                    "properties": {
                        "year": r["year"],
                        "tradeVolume": r["tradeVolume"],
                        "export_value_usd": r["exp_usd"],
                        "import_value_usd": r["imp_usd"],
                        "perspective": r["persp"]
                    }
                }
                async for r in c_edges
            ]

            cached_payload = {
                "metadata": {
                    "source": "UN_COMTRADE_2022_PREVIEW",
                    "node_count": len(nodes_list),
                    "edge_count": len(edges_list)
                },
                "nodes": nodes_list,
                "edges": edges_list
            }
            CACHE_FILE.write_text(json.dumps(cached_payload, indent=2), encoding="utf-8")
            print(f"Updated offline cache at {CACHE_FILE.name} with {len(nodes_list)} nodes and {len(edges_list)} edges.")

    await driver.close()


def main():
    parser = argparse.ArgumentParser(description="Phase 22: Seed Neo4j from verified bilateral trade data")
    parser.add_argument("--from-db", default="econosphere_migration_test", help="Read from PostgreSQL database")
    parser.add_argument("--from-csv", default=None, help="Read from CSV file instead of PostgreSQL")
    parser.add_argument("--year", type=int, default=None, help="Filter by year")
    parser.add_argument("--dry-run", action="store_true", help="Load and validate without writing to Neo4j")
    args = parser.parse_args()

    if args.from_csv:
        csv_p = Path(args.from_csv)
        print(f"Loading corridors from CSV: {csv_p}...")
        corridors, countries = load_corridors_from_csv(csv_p, year_filter=args.year)
    else:
        print(f"Loading corridors from PostgreSQL database '{args.from_db}'...")
        corridors, countries = asyncio.run(load_corridors_from_postgres(args.from_db, year_filter=args.year))

    print(f"Loaded {len(corridors)} trade corridors covering {len(countries)} countries.")

    if args.dry_run:
        print("[DRY RUN] Finished without writing to Neo4j.")
        return

    asyncio.run(seed_neo4j(corridors, countries))


if __name__ == "__main__":
    main()
