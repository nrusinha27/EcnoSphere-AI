"""
Phase 22 — Genuine End-to-End Integration Test Suite
=====================================================
Tests the complete end-to-end trade pipeline with real databases:
  UN Comtrade Raw Data
  -> PostgreSQL (econosphere_migration_test)
  -> Neo4j Graph Database
  -> FastAPI Backend Endpoints
  -> Response Verification (ISO3, Values, Disclaimers)

Zero artificial mocks. Primary validation executed against live instances.
"""
import pytest
import asyncpg
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.neo4j.session import neo4j_conn

client = TestClient(app)


class TestPostgreSQLLiveIntegration:
    @pytest.mark.asyncio
    async def test_postgres_table_and_records(self):
        """Verify real trade_flows records in isolated test database."""
        conn = await asyncpg.connect(
            user="postgres", password="Mane@123", host="localhost", port=5432, database="econosphere_migration_test"
        )
        try:
            cnt = await conn.fetchval("SELECT count(*) FROM trade_flows")
            assert cnt == 6576, f"Expected 6576 records in PostgreSQL, found {cnt}"

            # Verify USA imports from China (CIF)
            record = await conn.fetchrow("""
                SELECT trade_value_usd, valuation_type, flow_direction
                FROM trade_flows
                WHERE reporter_iso3 = 'USA' AND partner_iso3 = 'CHN' AND flow_direction = 'IMPORT'
            """)
            assert record is not None, "USA import from CHN record missing in PostgreSQL"
            assert isinstance(record["trade_value_usd"], Decimal)
            assert record["valuation_type"] == "CIF"
            assert record["trade_value_usd"] == Decimal("575688091172.00")
        finally:
            await conn.close()

    @pytest.mark.asyncio
    async def test_active_production_database_untouched(self):
        """Verify active production database 'econosphere' remains at revision 89c84394de95."""
        conn = await asyncpg.connect(
            user="postgres", password="Mane@123", host="localhost", port=5432, database="econosphere"
        )
        try:
            rev = await conn.fetchval("SELECT version_num FROM alembic_version")
            assert rev == "89c84394de95", f"Production revision altered: {rev}"

            tables = await conn.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
            t_names = {r["table_name"] for r in tables}
            assert "trade_flows" not in t_names, "Production database leaked trade_flows table!"
            assert len(t_names) == 10, f"Expected exactly 10 tables, found {len(t_names)}"
        finally:
            await conn.close()


class TestNeo4jLiveIntegration:
    @pytest.mark.asyncio
    async def test_neo4j_nodes_and_relationships(self):
        """Verify live Neo4j topology has ISO3 nodes and EXPORTS_TO edges."""
        await neo4j_conn.connect()
        async with neo4j_conn.driver.session() as s:
            n_res = await s.run("MATCH (n:Country) RETURN count(n) as cnt")
            n_cnt = (await n_res.single())["cnt"]
            assert n_cnt == 239, f"Expected 239 Country nodes, found {n_cnt}"

            r_res = await s.run("MATCH ()-[r:EXPORTS_TO]->() RETURN count(r) as cnt")
            r_cnt = (await r_res.single())["cnt"]
            assert r_cnt == 5543, f"Expected 5543 EXPORTS_TO edges, found {r_cnt}"

            # Verify USA node has iso3 property 'USA'
            usa = await s.run("MATCH (c:Country {iso3: 'USA'}) RETURN c.id as id, c.name as name")
            u_rec = await usa.single()
            assert u_rec is not None, "USA node missing in Neo4j"
            assert u_rec["id"] == "USA"
        await neo4j_conn.close()


class TestFastAPIEndToEndEndpoints:
    def test_get_network_2022_live(self):
        """Verify GET /api/v1/graph/network?year=2022 returns empirical nodes and edges."""
        response = client.get("/api/v1/graph/network?year=2022")
        assert response.status_code == 200
        data = response.json()
        assert len(data["nodes"]) >= 200
        assert len(data["edges"]) >= 1000

        # Verify USA node has ISO3 id
        usa = next((n for n in data["nodes"] if n["id"] == "USA"), None)
        assert usa is not None, "USA node missing from API response"
        assert usa["id"] == "USA"

    def test_get_network_unobserved_year_returns_empty_no_data(self):
        """Verify unobserved historical year returns explicit empty NO_DATA (HTTP 200, 0 records)."""
        response = client.get("/api/v1/graph/network?year=2015")
        assert response.status_code == 200
        data = response.json()
        assert len(data["nodes"]) == 0
        assert len(data["edges"]) == 0

    def test_get_country_metrics_usa(self):
        """Verify GET /api/v1/graph/metrics/USA returns verified empirical metrics."""
        response = client.get("/api/v1/graph/metrics/USA?year=2022")
        assert response.status_code == 200
        data = response.json()
        assert data["country_iso3"] == "USA"
        assert data["year"] == 2022
        assert data["total_reported_exports_usd"] > 1e11
        assert data["is_complete_national_statistic"] is False
        assert data["trade_concentration_hhi"] > 0
        assert len(data["top_export_partners"]) > 0

    def test_get_corridor_metrics_usa_chn(self):
        """Verify GET /api/v1/graph/corridor?source=USA&target=CHN returns empirical values."""
        response = client.get("/api/v1/graph/corridor?source=USA&target=CHN&year=2022")
        assert response.status_code == 200
        data = response.json()
        assert data["source_iso3"] == "USA"
        assert data["target_iso3"] == "CHN"
        assert data["reported_export_fob_usd"] is not None
        assert data["reported_import_cif_usd"] is not None

    def test_get_centrality_top_ranks(self):
        """Verify GET /api/v1/graph/centrality returns top exporter ranks."""
        response = client.get("/api/v1/graph/centrality")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 5
        # Scores must be positive out-degree counts
        assert all(r["score"] > 0 for r in data)
        assert all(len(r["node_id"]) == 3 for r in data)
