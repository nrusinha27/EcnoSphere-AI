from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.api.dependencies.database import get_db
from app.schemas.country import (
    CountryResponse,
    PaginatedCountryResponse,
    HistoricalIndicatorSchema,
    MultiCountryComparisonResponse,
    AvailableCountryOption,
)
from app.services.country import country_service
from app.services.comparison_service import comparison_service

router = APIRouter()

@router.get("", response_model=PaginatedCountryResponse)
async def get_countries(
    db: AsyncSession = Depends(get_db),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    region: Optional[str] = None
):
    countries, total = await country_service.get_countries(db, offset=offset, limit=limit, region=region)
    return PaginatedCountryResponse(
        data=countries,
        total=total,
        limit=limit,
        offset=offset
    )

@router.get("/search", response_model=List[CountryResponse])
async def search_countries(
    query: str,
    db: AsyncSession = Depends(get_db)
):
    if len(query) < 2:
        return []
    return await country_service.search_countries(db, query=query)


# ============================================================================
# Stage 3: Multi-Country Economic Comparison Endpoints
# (Must be defined before `/{iso3}` wildcard to prevent route shadowing)
# ============================================================================

@router.get(
    "/available-comparison-countries",
    response_model=List[AvailableCountryOption],
    summary="Get all countries available for multi-country economic comparison",
    description=(
        "Returns all 235 World Bank countries present in the master dataset, "
        "highlighting the 10 core economies and Stage 2 ML forecast-supported countries."
    ),
)
async def get_available_comparison_countries() -> List[AvailableCountryOption]:
    """Return list of countries available in the authentic economic dataset."""
    return comparison_service.get_available_countries()


@router.get(
    "/comparison",
    response_model=MultiCountryComparisonResponse,
    summary="Get multi-country economic comparison metrics and historical trends",
    description=(
        "Compares 2 to 5 countries across GDP growth, inflation, unemployment, fiscal metrics, "
        "and international trade. All values originate from authentic World Bank datasets. "
        "Returns latest observed values (with observation year) and historical time-series."
    ),
)
async def get_country_comparison(
    iso_codes: str = Query(
        ...,
        description="Comma-separated ISO-3 country codes (2 to 5 countries, e.g., 'USA,CHN,IND')",
        examples=["USA,CHN,IND", "GBR,FRA,DEU"],
    )
) -> MultiCountryComparisonResponse:
    """Return comparative macroeconomic indicators for 2 to 5 countries."""
    raw_codes = [c.strip().upper() for c in iso_codes.split(",") if c.strip()]
    if not raw_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No country codes provided. Please provide 2 to 5 comma-separated ISO-3 codes.",
        )

    # Validate ISO-3 format
    for code in raw_codes:
        if not code.isalpha() or len(code) != 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid country code '{code}'. Expected 3-letter ISO-3 code.",
            )

    try:
        result = comparison_service.get_multi_country_comparison(raw_codes)
        return result
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.get("/{iso3}", response_model=CountryResponse)
async def get_country(
    iso3: str,
    db: AsyncSession = Depends(get_db)
):
    country = await country_service.get_country_by_iso3(db, iso3=iso3.upper())
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")
    return country

@router.get("/{iso3}/history", response_model=List[HistoricalIndicatorSchema])
async def get_country_history(
    iso3: str,
    indicator: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    country = await country_service.get_country_by_iso3(db, iso3=iso3.upper())
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")
    return await country_service.get_country_history(db, iso3=iso3.upper(), indicator=indicator)
