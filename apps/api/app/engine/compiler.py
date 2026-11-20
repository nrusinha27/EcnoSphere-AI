from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.scenario import ScenarioVersion
from app.models.country import Country
from app.engine.interfaces import GlobalState


class ScenarioCompiler:
    """Fetches baseline data and scenario context before execution."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def fetch_baseline_state(self) -> GlobalState:
        """
        Fetches all countries and their latest indicators to form the baseline state.
        Returns a GlobalState dictionary keyed by ISO code.
        """
        stmt = select(Country).options(selectinload(Country.historical_indicators))
        result = await self.session.execute(stmt)
        countries = result.scalars().all()
        
        state: GlobalState = {}
        for country in countries:
            country_state = {
                "gdp": 0.0,
                "inflation": 0.0,
                "unemployment": 0.0,
                "interest_rate": 0.0,
                "trade_balance": 0.0,
            }
            if country.historical_indicators:
                for ind in sorted(country.historical_indicators, key=lambda x: x.year):
                    key = ind.indicator_name.lower().replace(" ", "_")
                    if key in country_state:
                        country_state[key] = float(ind.value)
            state[country.iso3] = country_state
        return state

    async def fetch_scenario_events(self, version_id: int):
        """Fetches the events attached to a specific scenario version."""
        stmt = select(ScenarioVersion).options(
            selectinload(ScenarioVersion.events)
        ).where(ScenarioVersion.id == version_id)
        result = await self.session.execute(stmt)
        version = result.scalar_one_or_none()
        if not version:
            raise ValueError(f"Scenario version {version_id} not found")
        return version.events

    async def fetch_scenario_events_by_scenario(self, scenario_id: int):
        """
        Fetches the events attached to the latest version of a scenario.
        Falls back to treating scenario_id == version_id when no explicit versioning exists.
        """
        # Try to find the latest version for this scenario
        stmt = (
            select(ScenarioVersion)
            .options(selectinload(ScenarioVersion.events))
            .where(ScenarioVersion.scenario_id == scenario_id)
            .order_by(ScenarioVersion.id.desc())
        )
        result = await self.session.execute(stmt)
        version = result.scalars().first()
        if not version:
            raise ValueError(f"No scenario version found for scenario_id={scenario_id}")
        return version.events
