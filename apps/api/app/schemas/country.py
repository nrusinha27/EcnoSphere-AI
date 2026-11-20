from pydantic import BaseModel, ConfigDict
from typing import Optional, List

class CountryMetadataSchema(BaseModel):
    capital: Optional[str] = None
    population: Optional[int] = None
    currency: Optional[str] = None
    flag_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)

class CountryBase(BaseModel):
    iso3: str
    name: str
    region: Optional[str] = None
    income_group: Optional[str] = None

class CountryResponse(CountryBase):
    metadata_info: Optional[CountryMetadataSchema] = None

    model_config = ConfigDict(from_attributes=True)

class HistoricalIndicatorSchema(BaseModel):
    indicator_name: str
    year: int
    value: float
    source: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
    
class PaginatedCountryResponse(BaseModel):
    data: List[CountryResponse]
    total: int
    limit: int
    offset: int


# ============================================================================
# Stage 3: Multi-Country Economic Comparison Schemas
# ============================================================================

class IndicatorDataPoint(BaseModel):
    indicator_key: str
    indicator_name: str
    category: str
    value: Optional[float] = None
    unit: str
    year: Optional[int] = None
    source: str = "World Bank WDI"
    status: str  # "available" | "unavailable"


class TimeSeriesPoint(BaseModel):
    year: int
    value: Optional[float] = None


class CountryComparisonProfile(BaseModel):
    country_code: str
    country_name: str
    is_forecast_supported: bool
    is_core_economy: bool
    latest_indicators: dict[str, IndicatorDataPoint]
    historical_gdp_growth: List[TimeSeriesPoint]
    historical_inflation: List[TimeSeriesPoint]
    historical_unemployment: List[TimeSeriesPoint]
    historical_trade_to_gdp: List[TimeSeriesPoint]


class FactualObservation(BaseModel):
    indicator_name: str
    country_code: str
    country_name: str
    value: float
    unit: str
    year: int
    observation_type: str  # "highest" | "lowest" | "spread"
    description: str


class MultiCountryComparisonResponse(BaseModel):
    countries: List[CountryComparisonProfile]
    compared_count: int
    observations: List[FactualObservation]
    common_years: List[int]
    data_disclaimer: str


class AvailableCountryOption(BaseModel):
    country_code: str
    country_name: str
    is_core_economy: bool
    is_forecast_supported: bool
    has_recent_data: bool

