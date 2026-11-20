/**
 * EconoSphere AI — Phase 11 Step 13 & Stage 2
 * React Query hooks for the locked Production ML GDP Forecast.
 *
 * These hooks fetch from /api/v1/forecasts (the locked HistGradientBoostingRegressor pipeline),
 * NOT from /api/v1/ai/forecast (the generative AI system).
 *
 * The two systems are intentionally separate:
 *   - Production ML Forecast: deterministic, artifact-based, RMSE=3.9113, Q90=11.4507
 *   - AI Forecast: generative, multi-horizon, SHAP-explained (existing /ai/forecast endpoints)
 */
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ForecastModelInfo {
  version: string;
  algorithm: string;
  test_rmse: number;
  train_period: string;
  validation_period: string;
  test_period: string;
}

export interface ForecastUncertaintyInfo {
  method: string;
  method_description: string;
  q90: number;
  coverage_target: number;
  step12_decision: string;
}

export interface GDPForecastResponse {
  country_code: string;
  country_name: string;
  feature_year: number;
  forecast_year: number;
  predicted_gdp_growth: number;
  lower_bound_90: number;
  upper_bound_90: number;
  interval_width: number;
  forecast_status: "forecast";
  model: ForecastModelInfo;
  uncertainty: ForecastUncertaintyInfo;
}

export interface ForecastMetadata {
  model_version: string;
  algorithm: string;
  test_rmse: number;
  train_period: string;
  validation_period: string;
  test_period: string;
  feature_year: number;
  forecast_year: number;
  uncertainty_method: string;
  q90: number;
  coverage_target: number;
  step12_decision: string;
  artifact_file: string;
  available_countries: string[];
  n_countries: number;
}

export interface ForecastListResponse {
  forecasts: GDPForecastResponse[];
  metadata: ForecastMetadata;
  disclaimer: string;
}

// ─── Stage 2: What-if inference types ────────────────────────────────────────

export interface InferenceRequest {
  country: string;
  year: number;
  exchange_rate_lcu_usd: number;
  tariff_rate_pct: number;
  remittances_usd: number;
  fdi_net_inflow_usd: number;
  unemployment_pct: number;
  imports_pct_gdp: number;
  tax_revenue_pct_gdp: number;
  exports_pct_gdp: number;
  interest_rate_pct: number;
  reserves_usd: number;
  current_account_pct_gdp: number;
  inflation_cpi_pct: number;
  population_total: number;
  gdp_current_usd: number;
  gdp_growth_lag1: number;
  gdp_growth_lag2: number;
  gdp_growth_lag3: number;
  inflation_lag1: number;
  unemployment_lag1: number;
  exports_lag1: number;
  imports_lag1: number;
  gdp_growth_rolling_mean_3: number;
  gdp_growth_rolling_std_3: number;
  gdp_growth_rolling_mean_5: number;
  inflation_rolling_mean_3: number;
  trade_openness: number;
  trade_balance_ratio: number;
  log_gdp_usd: number;
  log_population: number;
  gdp_growth_rolling_std_5: number;
  inflation_rolling_std_3: number;
}

export interface InferenceResponse {
  country: string;
  year: number;
  predicted_gdp_growth: number;
  lower_bound_90: number;
  upper_bound_90: number;
  interval_width: number;
  q90: number;
  model_version: string;
  production_status: string;
}

export interface CountryDefaults {
  country_code: string;
  country_name: string;
  feature_year: number;
  features: Partial<Record<keyof Omit<InferenceRequest, "country" | "year">, number | null>>;
  null_features: string[];
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetch all available country GDP growth forecasts from the locked ML pipeline.
 * Results are cached for 10 minutes (the artifact is static between ML runs).
 */
export function useMLForecasts() {
  return useQuery<ForecastListResponse>({
    queryKey: ["ml", "forecasts"],
    queryFn: async () => {
      const { data } = await apiClient.get<ForecastListResponse>("/forecasts");
      return data;
    },
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Fetch the locked ML GDP growth forecast for a specific country.
 * Returns undefined while loading, null if country has no forecast.
 */
export function useMLForecast(countryCode: string | undefined | null) {
  return useQuery<GDPForecastResponse>({
    queryKey: ["ml", "forecast", countryCode?.toUpperCase()],
    queryFn: async () => {
      const { data } = await apiClient.get<GDPForecastResponse>(
        `/forecasts/${countryCode!.toUpperCase()}`
      );
      return data;
    },
    enabled: !!countryCode && countryCode.trim().length === 3,
    staleTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      // Don't retry 404 (country not in forecast set) or 400 (bad code)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = (error as any)?.response?.status;
      if (status === 404 || status === 400) return false;
      return failureCount < 2;
    },
  });
}

/**
 * Fetch model provenance metadata for the locked ML pipeline.
 * Useful for displaying model information panels in the UI.
 */
export function useMLForecastMetadata() {
  return useQuery<ForecastMetadata>({
    queryKey: ["ml", "forecast", "metadata"],
    queryFn: async () => {
      const { data } = await apiClient.get<ForecastMetadata>("/forecasts/metadata");
      return data;
    },
    staleTime: 30 * 60 * 1000, // metadata almost never changes
    retry: 2,
  });
}

/**
 * Stage 2: Fetch 2025 feature defaults for a country (for form pre-population).
 */
export function useCountryDefaults(countryCode: string | null) {
  return useQuery<CountryDefaults>({
    queryKey: ["ml", "forecast", "defaults", countryCode],
    queryFn: async () => {
      const { data } = await apiClient.get<CountryDefaults>(
        `/forecasts/defaults/${countryCode!.toUpperCase()}`
      );
      return data;
    },
    enabled: !!countryCode,
    staleTime: 60 * 60 * 1000, // defaults are static
    retry: 1,
  });
}

/**
 * Stage 2: What-if GDP inference mutation.
 * POSTs to /api/v1/forecasts/gdp with full 31-feature payload.
 * Returns actual model prediction + 90% interval.
 */
export function useGDPInference() {
  return useMutation<InferenceResponse, Error, InferenceRequest>({
    mutationFn: async (request: InferenceRequest) => {
      const { data } = await apiClient.post<InferenceResponse>("/forecasts/gdp", request);
      return data;
    },
  });
}
