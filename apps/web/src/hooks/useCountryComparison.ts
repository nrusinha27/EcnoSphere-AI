import { useQuery } from '@tanstack/react-query';
import {
  fetchAvailableComparisonCountries,
  fetchCountryComparison,
  type AvailableCountryOption,
  type MultiCountryComparisonResponse,
} from '@/lib/api/compare';

export const useAvailableComparisonCountries = () => {
  return useQuery<AvailableCountryOption[]>({
    queryKey: ['countries', 'available-comparison'],
    queryFn: fetchAvailableComparisonCountries,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

export const useCountryComparison = (isoCodes: string[]) => {
  const sortedCodes = [...isoCodes].map((c) => c.trim().toUpperCase()).sort();
  const isValidCount = isoCodes.length >= 2 && isoCodes.length <= 5;

  return useQuery<MultiCountryComparisonResponse>({
    queryKey: ['countries', 'comparison', sortedCodes.join(',')],
    queryFn: () => fetchCountryComparison(isoCodes),
    enabled: isValidCount,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};
