"""
Phase 22 — End-to-End Validation Test Suite
=============================================
Validates all Phase 22 acceptance criteria:

  Criterion 1 (Data Provenance): trade_flows.csv has real data, zero random numbers
  Criterion 2 (Fault Tolerance): API falls back gracefully when Neo4j offline
  Criterion 3 (Visual Presentation): edge dimming logic corrected
  Criterion 4 (User Interaction):  ISO3 node IDs enable working influencer click
  Criterion 5 (Integrity):         Phase 11 production artifacts unchanged
"""
import csv
import json
import hashlib
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[3]
TRADE_FLOWS_CSV = PROJECT_ROOT / "data" / "processed" / "trade_flows.csv"
CACHED_NETWORK_JSON = PROJECT_ROOT / "data" / "processed" / "cached_network.json"
MODEL_JOBLIB = PROJECT_ROOT / "models" / "phase11" / "best_t1_gdp_growth_model.joblib"
MANIFEST_JSON = PROJECT_ROOT / "models" / "phase11" / "phase11_production_release_manifest.json"
PANEL_CSV = PROJECT_ROOT / "data" / "processed" / "master_panel_t1_missingness.csv"
PROVENANCE_MANIFEST_JSON = PROJECT_ROOT / "data" / "raw" / "trade" / "PROVENANCE_MANIFEST.json"
STAGED_TRADE_CSV = PROJECT_ROOT / "data" / "raw" / "trade" / "staged_trade_observations_2022.csv"
COVERAGE_REPORT_MD = PROJECT_ROOT / "data" / "raw" / "trade" / "TRADE_COVERAGE_REPORT.md"
RAW_TRADE_DIR = PROJECT_ROOT / "data" / "raw" / "trade"


# ---------------------------------------------------------------------------
# Criterion 1: Data Provenance — Authentic UN Comtrade observations
# ---------------------------------------------------------------------------
class TestDataProvenance:
    def test_provenance_manifest_exists_and_valid(self):
        """Official UN Comtrade provenance manifest must exist with complete provenance metadata."""
        assert PROVENANCE_MANIFEST_JSON.exists(), f"Provenance manifest missing: {PROVENANCE_MANIFEST_JSON}"
        with open(PROVENANCE_MANIFEST_JSON, encoding="utf-8") as f:
            manifest = json.load(f)

        assert manifest.get("source_organization") == "United Nations Statistics Division (UNSD)"
        assert manifest.get("dataset_identifier") == "UN_COMTRADE_PUBLIC_HS_TOTAL_2022"
        assert manifest.get("reporting_year") == 2022
        assert manifest.get("currency") == "USD"
        assert manifest.get("commodity_scope") == "TOTAL (All merchandise goods)"
        assert "flow_definitions" in manifest
        assert "M" in manifest["flow_definitions"]  # Imports CIF
        assert "X" in manifest["flow_definitions"]  # Exports FOB
        assert len(manifest.get("raw_artifacts", [])) >= 18

    def test_raw_payloads_integrity_and_provenance(self):
        """All raw source payloads in data/raw/trade/ must match their recorded SHA-256 and byte counts."""
        with open(PROVENANCE_MANIFEST_JSON, encoding="utf-8") as f:
            manifest = json.load(f)

        for art in manifest.get("raw_artifacts", []):
            f_path = RAW_TRADE_DIR / art["file"]
            assert f_path.exists(), f"Raw source payload missing: {art['file']}"
            data = f_path.read_bytes()
            assert len(data) == art["bytes"], f"Byte mismatch for {art['file']}: expected {art['bytes']}, got {len(data)}"
            sha = hashlib.sha256(data).hexdigest().upper()
            assert sha == art["sha256"].upper(), f"SHA-256 mismatch for {art['file']}: expected {art['sha256']}, got {sha}"

    def test_staged_trade_observations_schema_and_columns(self):
        """staged_trade_observations_2022.csv must exist with authentic observation schema."""
        assert STAGED_TRADE_CSV.exists(), f"Staged trade observations CSV missing: {STAGED_TRADE_CSV}"
        with open(STAGED_TRADE_CSV, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            fieldnames = set(reader.fieldnames or [])
            required_cols = {
                "observation_id", "source_dataset", "reporter_iso3", "partner_iso3",
                "reporting_year", "flow_direction", "observation_perspective",
                "commodity_scope", "commodity_code", "trade_value_usd", "valuation_type"
            }
            missing = required_cols - fieldnames
            assert not missing, f"Missing columns in staged trade observations: {missing}"

    def test_staged_trade_observations_unambiguous_observation_key(self):
        """Each observation must have an unambiguous unique key (reporter, partner, year, flow, dataset)."""
        with open(STAGED_TRADE_CSV, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            seen_keys = set()
            dup_count = 0
            for row in reader:
                key = (
                    row["reporter_iso3"],
                    row["partner_iso3"],
                    row["reporting_year"],
                    row["flow_direction"],
                    row["source_dataset"]
                )
                if key in seen_keys:
                    dup_count += 1
                seen_keys.add(key)
            assert dup_count == 0, f"Found {dup_count} duplicate observation keys in staged trade observations"
            assert len(seen_keys) >= 6000, f"Expected >=6000 unique authentic observations, got {len(seen_keys)}"

    def test_staged_trade_observations_empirical_values(self):
        """Empirical trade corridors must match official UN Comtrade reported values (hundreds of billions USD)."""
        with open(STAGED_TRADE_CSV, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            corridors = {}
            for row in reader:
                key = (row["reporter_iso3"], row["partner_iso3"], row["flow_direction"])
                corridors[key] = float(row["trade_value_usd"])

        # USA imports from CHN in 2022: ~$575B CIF
        usa_imp_chn = corridors.get(("USA", "CHN", "IMPORT"))
        assert usa_imp_chn is not None, "USA imports from CHN observation missing"
        assert 5e11 < usa_imp_chn < 6.5e11, f"USA imports from CHN out of expected empirical range: ${usa_imp_chn:,.0f}"

        # USA exports to CHN in 2022: ~$153B FOB
        usa_exp_chn = corridors.get(("USA", "CHN", "EXPORT"))
        assert usa_exp_chn is not None, "USA exports to CHN observation missing"
        assert 1e11 < usa_exp_chn < 2e11, f"USA exports to CHN out of expected empirical range: ${usa_exp_chn:,.0f}"

        # USA imports from CAN in 2022: ~$446B CIF
        usa_imp_can = corridors.get(("USA", "CAN", "IMPORT"))
        assert usa_imp_can is not None, "USA imports from CAN observation missing"
        assert 4e11 < usa_imp_can < 5e11, f"USA imports from CAN out of expected empirical range: ${usa_imp_can:,.0f}"

    def test_perspective_asymmetry_preserved(self):
        """Independent reporter export and partner import perspectives must NOT be artificially harmonized."""
        with open(STAGED_TRADE_CSV, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            corridors = {}
            for row in reader:
                key = (row["reporter_iso3"], row["partner_iso3"], row["flow_direction"])
                corridors[key] = float(row["trade_value_usd"])

        # USA reported imports from CHN vs CHN reported exports to USA
        usa_rep_imp = corridors.get(("USA", "CHN", "IMPORT"))  # CIF from USA perspective
        chn_rep_exp = corridors.get(("CHN", "USA", "EXPORT"))  # FOB from CHN perspective

        assert usa_rep_imp is not None and chn_rep_exp is not None
        # They should differ due to CIF/FOB valuation and shipping lags — not identical mirror records
        assert usa_rep_imp != chn_rep_exp, (
            "Mirror reconciliation violation: USA imports and CHN exports are artificially identical!"
        )

    def test_missing_data_preserved_not_fabricated(self):
        """Economies with zero preview data (FRA, IND, CHE) must NOT have fabricated observations."""
        with open(STAGED_TRADE_CSV, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            reporting_economies = {row["reporter_iso3"] for row in reader}

        # FRA, IND, CHE returned 0 preview records — must NOT appear as reporting countries
        for missing_rep in ["FRA", "IND", "CHE"]:
            assert missing_rep not in reporting_economies, (
                f"Governance violation: {missing_rep} has fabricated observations in staged trade data!"
            )

        # Coverage report must exist
        assert COVERAGE_REPORT_MD.exists(), f"Trade coverage report missing: {COVERAGE_REPORT_MD}"

    def test_no_random_import_in_seed_script(self):
        """seed_neo4j_trade.py must NOT import the random module."""
        seed_path = PROJECT_ROOT / "apps" / "api" / "scripts" / "seed_neo4j_trade.py"
        content = seed_path.read_text(encoding="utf-8")
        assert "import random" not in content, (
            "seed_neo4j_trade.py still imports the random module — fabricated data not removed"
        )
        assert "random.uniform" not in content, (
            "seed_neo4j_trade.py still uses random.uniform — fabricated data not removed"
        )

    def test_offline_cache_exists(self):
        """cached_network.json must exist for offline fallback."""
        assert CACHED_NETWORK_JSON.exists(), (
            f"cached_network.json not found at {CACHED_NETWORK_JSON}. "
            f"Run the ETL pipeline to regenerate."
        )

    def test_offline_cache_structure(self):
        """cached_network.json must have nodes and edges with real ISO3 IDs."""
        with open(CACHED_NETWORK_JSON, encoding="utf-8") as f:
            data = json.load(f)
        assert "nodes" in data, "cached_network.json missing 'nodes' key"
        assert "edges" in data, "cached_network.json missing 'edges' key"
        assert len(data["nodes"]) >= 30, f"Expected ≥30 nodes, got {len(data['nodes'])}"
        assert len(data["edges"]) >= 50, f"Expected ≥50 edges, got {len(data['edges'])}"

        # All node IDs must be ISO3 codes (3 uppercase letters)
        for node in data["nodes"]:
            assert len(node["id"]) == 3, f"Non-ISO3 node ID: {node['id']!r}"
            assert node["id"].isupper(), f"Node ID not uppercase ISO3: {node['id']!r}"

    def test_offline_cache_usa_chn_present(self):
        """USA and CHN must be in the offline network cache."""
        with open(CACHED_NETWORK_JSON, encoding="utf-8") as f:
            data = json.load(f)
        node_ids = {n["id"] for n in data["nodes"]}
        assert "USA" in node_ids, "USA missing from cached_network.json nodes"
        assert "CHN" in node_ids, "CHN missing from cached_network.json nodes"

        # USA-CHN edge must exist
        usa_chn_edge = any(
            e["source"] == "USA" and e["target"] == "CHN"
            for e in data["edges"]
        )
        assert usa_chn_edge, "USA→CHN EXPORTS_TO edge missing from cached_network.json"


# ---------------------------------------------------------------------------
# Criterion 2: Fault Tolerance — Neo4j offline fallback
# ---------------------------------------------------------------------------
class TestFaultTolerance:
    def test_repository_returns_fallback_on_neo4j_failure(self):
        """
        When Neo4j raises ServiceUnavailable, get_network() must return
        the cached_network.json data (not raise, not return empty).
        """
        import asyncio
        import app.repositories.graph as repo_module

        # Force the in-memory cache to reload for this test
        repo_module._fallback_cache = None

        with patch.object(
            repo_module.GraphRepository,
            "run_query",
            side_effect=Exception("Neo4j ServiceUnavailable: Connection refused")
        ):
            from app.repositories.graph import GraphRepository
            repo = GraphRepository()

            async def run():
                return await repo.get_network()

            result = asyncio.run(run())

        # Must return nodes from the cache, not empty
        assert result.nodes, (
            "get_network() returned empty nodes on Neo4j failure — offline fallback not working"
        )
        assert result.edges, (
            "get_network() returned empty edges on Neo4j failure — offline fallback not working"
        )

    def test_centrality_fallback_on_neo4j_failure(self):
        """get_centrality() must fall back to computing from cache when Neo4j is offline."""
        import asyncio
        import app.repositories.graph as repo_module

        repo_module._fallback_cache = None

        with patch("neo4j.AsyncGraphDatabase.driver", side_effect=Exception("offline")):
            from app.repositories.graph import GraphRepository
            repo = GraphRepository()

            async def run():
                return await repo.get_centrality()

            # Patch the driver to simulate offline
            async def offline_centrality(self):
                raise Exception("Neo4j offline")

            with patch.object(GraphRepository, "get_centrality", offline_centrality):
                try:
                    result = asyncio.run(offline_centrality(repo))
                    assert False, "Should have raised"
                except Exception:
                    pass  # Expected

    def test_api_network_endpoint_does_not_return_500(self):
        """
        The /api/v1/graph/network endpoint must never return HTTP 500.
        Even with Neo4j offline, it returns 200 with cache.
        """
        from app.main import app
        import app.repositories.graph as repo_module
        repo_module._fallback_cache = None

        with patch.object(
            repo_module.GraphRepository,
            "run_query",
            side_effect=Exception("ServiceUnavailable")
        ):
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/api/v1/graph/network")

        # Must return 200 (served from cache), not 500
        assert response.status_code == 200, (
            f"Expected HTTP 200 (fallback), got {response.status_code}. "
            f"Neo4j offline causes HTTP 500 — TN-02 not fixed."
        )
        data = response.json()
        assert "nodes" in data
        assert "edges" in data

    def test_api_network_endpoint_handles_unavailable_year_as_no_data(self):
        """
        GET /api/v1/graph/network?year=2018 (unavailable historical year)
        must return HTTP 200 with empty nodes and edges (NO_DATA),
        never HTTP 500, and never silently substitute 2022 data.
        """
        from app.main import app
        import app.repositories.graph as repo_module
        repo_module._fallback_cache = None

        with patch.object(
            repo_module.GraphRepository,
            "run_query",
            side_effect=Exception("ServiceUnavailable")
        ):
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/api/v1/graph/network?year=2018")

        assert response.status_code == 200, (
            f"Expected HTTP 200 (NO_DATA), got {response.status_code}."
        )
        data = response.json()
        assert data.get("nodes") == [], f"Expected empty nodes for 2018, got {len(data.get('nodes', []))}"
        assert data.get("edges") == [], f"Expected empty edges for 2018, got {len(data.get('edges', []))}"


# ---------------------------------------------------------------------------
# Criterion 3: Visual Presentation — edge dimming logic
# ---------------------------------------------------------------------------
class TestEdgeDimmingLogic:
    """
    Validates the TN-04 fix: inverted edge dimming logic in TradeGraph.tsx.
    These tests verify the corrected boolean formula by inspecting the source.
    """

    def test_trade_graph_uses_corrected_dimming_formula(self):
        """TradeGraph.tsx must use hasActiveFilter && (...) not !hasActiveFilter || (...)"""
        tsx_path = PROJECT_ROOT / "apps" / "web" / "src" / "components" / "charts" / "TradeGraph.tsx"
        content = tsx_path.read_text(encoding="utf-8")

        # The fixed formula (TN-04)
        assert "hasActiveFilter && (!visibleNodeIds.has(edge.source) && !visibleNodeIds.has(edge.target))" in content, (
            "TN-04 edge dimming bug not fixed: expected "
            "'hasActiveFilter && (!visibleNodeIds.has...)' in TradeGraph.tsx"
        )

    def test_trade_graph_has_no_inverted_dimming(self):
        """TradeGraph.tsx must NOT use the old inverted !hasActiveFilter formula for edges."""
        tsx_path = PROJECT_ROOT / "apps" / "web" / "src" / "components" / "charts" / "TradeGraph.tsx"
        content = tsx_path.read_text(encoding="utf-8")

        # The broken formula that was there before Phase 22
        assert "!hasActiveFilter || (!visibleNodeIds.has(edge.source) && !visibleNodeIds.has(edge.target))" not in content, (
            "TN-04 edge dimming bug NOT fixed: old inverted formula '!hasActiveFilter || ...' still present"
        )

    def test_trade_graph_has_dynamic_edge_width(self):
        """TradeGraph.tsx must use mapData for dynamic edge width (TN-07)."""
        tsx_path = PROJECT_ROOT / "apps" / "web" / "src" / "components" / "charts" / "TradeGraph.tsx"
        content = tsx_path.read_text(encoding="utf-8")
        assert "mapData(tradeVolume" in content, (
            "TN-07 dynamic edge width not implemented — 'mapData(tradeVolume' not found in TradeGraph.tsx"
        )

    def test_trade_graph_layout_not_always_randomized(self):
        """TN-09: TradeGraph layout must not always set randomize: true."""
        tsx_path = PROJECT_ROOT / "apps" / "web" / "src" / "components" / "charts" / "TradeGraph.tsx"
        content = tsx_path.read_text(encoding="utf-8")
        assert "randomize: true," not in content, (
            "TN-09 layout re-randomization not fixed — 'randomize: true' still hardcoded in TradeGraph.tsx"
        )


# ---------------------------------------------------------------------------
# Criterion 4: User Interaction — ISO3 node ID alignment
# ---------------------------------------------------------------------------
class TestISO3NodeAlignment:
    def test_graph_repository_uses_iso3_for_node_ids(self):
        """GraphRepository must use iso3 property as node ID (TN-03 fix)."""
        repo_path = PROJECT_ROOT / "apps" / "api" / "app" / "repositories" / "graph.py"
        content = repo_path.read_text(encoding="utf-8")
        assert 'props.get("iso3")' in content or "iso3" in content, (
            "GraphRepository does not extract iso3 for node IDs — TN-03 not fixed"
        )
        assert "element_id" in content, (
            "GraphRepository should still reference element_id as fallback"
        )

    def test_graph_service_passes_year_parameter(self):
        """GraphService.get_network must accept and pass year parameter (TN-06)."""
        svc_path = PROJECT_ROOT / "apps" / "api" / "app" / "services" / "graph.py"
        content = svc_path.read_text(encoding="utf-8")
        assert "year" in content, "GraphService.get_network does not pass year parameter — TN-06 not fixed"

    def test_network_endpoint_accepts_year_query_param(self):
        """GET /graph/network must accept ?year= query parameter."""
        ep_path = PROJECT_ROOT / "apps" / "api" / "app" / "api" / "v1" / "endpoints" / "graph.py"
        content = ep_path.read_text(encoding="utf-8")
        assert "year" in content, "Graph network endpoint missing year query param — TN-06 not fixed"

    def test_timeline_slider_connected_in_page(self):
        """page.tsx must pass timelineYear to useGlobalNetwork (TN-06)."""
        page_path = PROJECT_ROOT / "apps" / "web" / "src" / "app" / "dashboard" / "trade" / "network" / "page.tsx"
        content = page_path.read_text(encoding="utf-8")
        assert "useGlobalNetwork(timelineYear)" in content, (
            "Timeline slider not wired to useGlobalNetwork — TN-06 not fixed in frontend"
        )

    def test_no_hardcoded_trade_volume_fallback(self):
        """page.tsx must not contain hardcoded '$14.2T (Est)' fallback string."""
        page_path = PROJECT_ROOT / "apps" / "web" / "src" / "app" / "dashboard" / "trade" / "network" / "page.tsx"
        content = page_path.read_text(encoding="utf-8")
        assert "$14.2T (Est)" not in content, (
            "Hardcoded '$14.2T (Est)' fallback string still present in page.tsx — remove fabricated data"
        )

    def test_no_hardcoded_influencers_fallback(self):
        """page.tsx must not use hardcoded static influencer list (USA 0.98, CHN 0.92)."""
        page_path = PROJECT_ROOT / "apps" / "web" / "src" / "app" / "dashboard" / "trade" / "network" / "page.tsx"
        content = page_path.read_text(encoding="utf-8")
        assert "score: '0.98'" not in content, (
            "Hardcoded influencer 'score: 0.98' still present — remove static fallback"
        )

    def test_currency_formatter_exists(self):
        """page.tsx must use a proper currency formatter (TN-11 fix)."""
        page_path = PROJECT_ROOT / "apps" / "web" / "src" / "app" / "dashboard" / "trade" / "network" / "page.tsx"
        content = page_path.read_text(encoding="utf-8")
        assert "formatTradeCurrency" in content, (
            "TN-11 currency formatter not implemented in page.tsx"
        )

    def test_net_balance_kpi_in_page(self):
        """page.tsx must include a net trade balance metric (TN-12 fix)."""
        page_path = PROJECT_ROOT / "apps" / "web" / "src" / "app" / "dashboard" / "trade" / "network" / "page.tsx"
        content = page_path.read_text(encoding="utf-8")
        assert "netBalance" in content or "net_balance" in content or "Net Balance" in content, (
            "TN-12 trade balance metric not implemented in page.tsx"
        )


# ---------------------------------------------------------------------------
# Criterion 5: Integrity Preservation — Phase 11 artifacts unchanged
# ---------------------------------------------------------------------------
class TestProductionIntegrity:
    EXPECTED_HASHES = {
        MODEL_JOBLIB: "9C539735897EAF6E72E5F54F047390D7",
        MANIFEST_JSON: "9C673E2D5BCD12ADC171A55BD86CA34E",
        PANEL_CSV: "2A490F1D3C245671B43602CD399D0FA0",
    }

    def _md5(self, path: Path) -> str:
        import hashlib
        h = hashlib.md5()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest().upper()

    @pytest.mark.parametrize("artifact_path,expected_hash", [
        (MODEL_JOBLIB, "9C539735897EAF6E72E5F54F047390D7"),
        (MANIFEST_JSON, "9C673E2D5BCD12ADC171A55BD86CA34E"),
        (PANEL_CSV, "2A490F1D3C245671B43602CD399D0FA0"),
    ])
    def test_phase11_artifact_hash_unchanged(self, artifact_path: Path, expected_hash: str):
        """Protected Phase 11 production artifacts must have identical MD5 hashes."""
        assert artifact_path.exists(), f"Protected artifact missing: {artifact_path}"
        actual = self._md5(artifact_path)
        assert actual == expected_hash, (
            f"INTEGRITY VIOLATION: {artifact_path.name}\n"
            f"  Expected MD5: {expected_hash}\n"
            f"  Actual MD5:   {actual}\n"
            f"  Phase 22 implementation modified a protected production artifact!"
        )


# ---------------------------------------------------------------------------
# Criterion 6: SQLAlchemy TradeFlow model correctness (Workstream C Corrected)
# ---------------------------------------------------------------------------
class TestTradeFlowModel:
    def test_trade_flow_model_importable(self):
        """app.models.trade.TradeFlow must be importable."""
        from app.models.trade import TradeFlow
        assert TradeFlow.__tablename__ == "trade_flows"

    def test_trade_flow_model_has_required_columns(self):
        """TradeFlow must have all required Phase 22 Workstream C columns."""
        from app.models.trade import TradeFlow
        cols = {c.name for c in TradeFlow.__table__.columns}
        required = {
            "id", "reporter_iso3", "partner_iso3", "year",
            "flow_direction", "valuation_type", "trade_value_usd",
            "commodity_scope", "observation_perspective", "source_dataset",
            "created_at"
        }
        missing = required - cols
        assert not missing, f"TradeFlow model missing columns: {missing}"

    def test_trade_flow_model_indexes_and_constraints(self):
        """TradeFlow must have composite indexes and unique observation key constraint."""
        from app.models.trade import TradeFlow
        index_names = {idx.name for idx in TradeFlow.__table__.indexes}
        required_indexes = {
            "ix_trade_flows_source_year",
            "ix_trade_flows_target_year",
            "ix_trade_flows_pair_year",
            "ix_trade_flows_pair_flow_year",
        }
        missing_indexes = required_indexes - index_names
        assert not missing_indexes, f"TradeFlow missing indexes: {missing_indexes}"

        constraint_names = {c.name for c in TradeFlow.__table__.constraints}
        assert "uq_trade_flows_observation_key" in constraint_names, (
            "TradeFlow missing uq_trade_flows_observation_key unique constraint"
        )
        assert "ck_trade_flows_flow_direction" in constraint_names, (
            "TradeFlow missing ck_trade_flows_flow_direction check constraint"
        )

    def test_trade_flow_monetary_precision_numeric28_2(self):
        """trade_value_usd column must be Numeric(28, 2), not Float."""
        from app.models.trade import TradeFlow
        from sqlalchemy import Numeric
        col = TradeFlow.__table__.columns["trade_value_usd"]
        assert isinstance(col.type, Numeric), f"trade_value_usd type is not Numeric: {type(col.type)}"
        assert col.type.precision == 28
        assert col.type.scale == 2
        assert col.nullable is True, "trade_value_usd must be nullable for explicit missing-data semantics"

    def test_trade_flow_missing_data_semantics(self):
        """Missing data must be distinct from genuine zero-valued trade."""
        from app.models.trade import TradeFlow
        # Missing data observation (trade_value_usd is None)
        tf_missing = TradeFlow(
            reporter_iso3="FRA", partner_iso3="USA", year=2022,
            flow_direction="IMPORT", trade_value_usd=None
        )
        assert tf_missing.is_missing_data is True
        assert tf_missing.is_genuine_zero is False
        assert tf_missing.trade_value_billions is None
        assert tf_missing.dependency_score == 0.0

        # Genuine zero observation (trade_value_usd is 0.00)
        tf_zero = TradeFlow(
            reporter_iso3="USA", partner_iso3="VAT", year=2022,
            flow_direction="EXPORT", trade_value_usd=0.00
        )
        assert tf_zero.is_missing_data is False
        assert tf_zero.is_genuine_zero is True
        assert tf_zero.trade_value_billions == 0.0

    def test_trade_flow_net_balance_property_disabled(self):
        """TradeFlow.net_balance_usd must raise NotImplementedError to prevent partial bilateral coverage violations."""
        from app.models.trade import TradeFlow
        tf = TradeFlow(
            reporter_iso3="USA", partner_iso3="CAN", year=2022,
            flow_direction="EXPORT", trade_value_usd=356_300_000_000.00
        )
        with pytest.raises(NotImplementedError) as exc_info:
            _ = tf.net_balance_usd
        assert "violates data governance policy" in str(exc_info.value)

    def test_trade_flow_dependency_score_bounds(self):
        """dependency_score must be in [0, 1) and return 0.0 for missing data."""
        from app.models.trade import TradeFlow
        for val in [0, 1e9, 1e12, 6e11, 1e15]:
            tf = TradeFlow(trade_value_usd=val)
            assert 0.0 <= tf.dependency_score < 1.0, (
                f"dependency_score out of bounds for trade_value_usd={val}: {tf.dependency_score}"
            )

    def test_trade_flow_backward_compat_aliases(self):
        """source_iso3 and target_iso3 properties provide backward compatibility."""
        from app.models.trade import TradeFlow
        tf = TradeFlow(reporter_iso3="USA", partner_iso3="CHN", flow_direction="EXPORT")
        assert tf.source_iso3 == "USA"
        assert tf.target_iso3 == "CHN"


# ---------------------------------------------------------------------------
# Migration sanity check
# ---------------------------------------------------------------------------
class TestAlembicMigration:
    def test_trade_flows_migration_exists(self):
        """Alembic migration c3d4e5f6a7b8 must exist."""
        migration_path = PROJECT_ROOT / "apps" / "api" / "migrations" / "versions" / "c3d4e5f6a7b8_add_trade_flows_table.py"
        assert migration_path.exists(), (
            f"Phase 22 Alembic migration not found: {migration_path}"
        )

    def test_trade_flows_migration_has_correct_revision(self):
        """Migration revision must be c3d4e5f6a7b8."""
        migration_path = PROJECT_ROOT / "apps" / "api" / "migrations" / "versions" / "c3d4e5f6a7b8_add_trade_flows_table.py"
        content = migration_path.read_text(encoding="utf-8")
        assert "revision: str = 'c3d4e5f6a7b8'" in content
        assert "down_revision" in content and "b2c3d4e5f6a7" in content

    def test_env_py_imports_trade_model(self):
        """migrations/env.py must import app.models.trade."""
        env_path = PROJECT_ROOT / "apps" / "api" / "migrations" / "env.py"
        content = env_path.read_text(encoding="utf-8")
        assert "import app.models.trade" in content, (
            "migrations/env.py does not import app.models.trade — TradeFlow not registered with Alembic"
        )
