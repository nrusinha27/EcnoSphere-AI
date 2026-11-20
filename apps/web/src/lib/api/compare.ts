import { apiClient } from './client';

export interface IndicatorDataPoint {
  indicator_key: string;
  indicator_name: string;
  category: string;
  value: number | null;
  unit: string;
  year: number | null;
  source: string;
  status: 'available' | 'unavailable';
}

export interface TimeSeriesPoint {
  year: number;
  value: number | null;
}

export interface CountryComparisonProfile {
  country_code: string;
  country_name: string;
  is_forecast_supported: boolean;
  is_core_economy: boolean;
  latest_indicators: Record<string, IndicatorDataPoint>;
  historical_gdp_growth: TimeSeriesPoint[];
  historical_inflation: TimeSeriesPoint[];
  historical_unemployment: TimeSeriesPoint[];
  historical_trade_to_gdp: TimeSeriesPoint[];
}

export interface FactualObservation {
  indicator_name: string;
  country_code: string;
  country_name: string;
  value: number;
  unit: string;
  year: number;
  observation_type: 'highest' | 'lowest' | 'spread';
  description: string;
}

export interface MultiCountryComparisonResponse {
  countries: CountryComparisonProfile[];
  compared_count: number;
  observations: FactualObservation[];
  common_years: number[];
  data_disclaimer: string;
}

export interface AvailableCountryOption {
  country_code: string;
  country_name: string;
  is_core_economy: boolean;
  is_forecast_supported: boolean;
  has_recent_data: boolean;
}

export const fetchAvailableComparisonCountries = async (): Promise<AvailableCountryOption[]> => {
  const { data } = await apiClient.get<AvailableCountryOption[]>('/countries/available-comparison-countries');
  return data;
};

export const fetchCountryComparison = async (isoCodes: string[]): Promise<MultiCountryComparisonResponse> => {
  const joined = isoCodes.join(',');
  const { data } = await apiClient.get<MultiCountryComparisonResponse>('/countries/comparison', {
    params: { iso_codes: joined },
  });
  return data;
};
