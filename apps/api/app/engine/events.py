from typing import List, Dict, Any
from app.models.scenario import ScenarioEvent
from app.engine.interfaces import ShockVector

class EventProcessor:
    """Parses ScenarioEvents into quantitative initial ShockVectors."""
    
    def process(self, events: List[ScenarioEvent]) -> ShockVector:
        """
        Translates a list of ScenarioEvents into a unified ShockVector.

        Handles two storage formats for affectedNodes:
          - Dict format (preferred):  {"USA": {"export_reduction": -0.1}, ...}
          - List format (legacy/seed): ["USA", "CHN"]  → each country gets
            a default export_reduction shock equal to -shockIntensity.

        Example Output:
        {
            "USA": {"tariff": 0.25, "export_reduction": -0.1},
            "CHN": {"export_reduction": -0.25}
        }
        """
        initial_shocks: ShockVector = {}
        
        for event in events:
            affected_nodes_raw = event.affectedNodes or {}
            intensity = event.shockIntensity or 1.0

            # Normalise affectedNodes to dict form
            if isinstance(affected_nodes_raw, list):
                # Legacy list format: treat each ISO as affected with a default impact
                affected_nodes: Dict[str, Dict[str, float]] = {
                    iso: {"export_reduction": -abs(intensity)}
                    for iso in affected_nodes_raw
                    if isinstance(iso, str)
                }
            elif isinstance(affected_nodes_raw, dict):
                affected_nodes = affected_nodes_raw
            else:
                # Unknown format — skip safely
                affected_nodes = {}

            for country_iso, impacts in affected_nodes.items():
                if country_iso not in initial_shocks:
                    initial_shocks[country_iso] = {}
                
                # Ensure impacts is a dict (guard against nested list edge-case)
                if not isinstance(impacts, dict):
                    impacts = {"export_reduction": -abs(intensity)}
                
                # Apply the intensity multiplier to the baseline impact
                for metric, value in impacts.items():
                    current_val = initial_shocks[country_iso].get(metric, 0.0)
                    # Accumulate shocks additively
                    initial_shocks[country_iso][metric] = current_val + (float(value) * intensity)
                    
        return initial_shocks
