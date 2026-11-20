'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Scale,
  Sparkles,
  ArrowRight,
  Cpu,
  Brain,
  AlertCircle,
  RefreshCw,
  Layers,
  Database,
  BarChart2,
} from 'lucide-react';
import {
  useAvailableComparisonCountries,
  useCountryComparison,
} from '@/hooks/useCountryComparison';
import { CountrySelector } from '@/components/compare/CountrySelector';
import { ComparisonSummaryCards } from '@/components/compare/ComparisonSummaryCards';
import { GDPComparisonChart } from '@/components/compare/GDPComparisonChart';
import { HistoricalTrendChart } from '@/components/compare/HistoricalTrendChart';
import { MacroIndicatorCharts } from '@/components/compare/MacroIndicatorCharts';
import { ComparisonTable } from '@/components/compare/ComparisonTable';
import { EconomicInsightsPanel } from '@/components/compare/EconomicInsightsPanel';

export default function CountryComparisonDashboard() {
  const [selectedCodes, setSelectedCodes] = useState<string[]>(['USA', 'CHN', 'IND']);

  // Fetch available countries catalog (235 countries from master_panel)
  const {
    data: availableCountries = [],
    isLoading: isAvailableLoading,
    error: availableError,
  } = useAvailableComparisonCountries();

  // Fetch comparison data for currently selected countries (2 to 5)
  const {
    data: comparisonData,
    isLoading: isComparisonLoading,
    isFetching: isComparisonFetching,
    error: comparisonError,
    refetch,
  } = useCountryComparison(selectedCodes);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50 p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Multi-Country Economic Comparison Dashboard
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  EDI Stage 3
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Dynamic cross-country macroeconomic benchmarking powered by authentic World Bank WDI datasets (2000–2025).
              </p>
            </div>
          </div>
        </div>

        {/* Stage 1 & Stage 2 Cross-Links */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/dashboard/forecast"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors shadow-xs"
          >
            <Brain className="w-3.5 h-3.5 text-purple-500" />
            <span>Stage 2 ML Forecast</span>
            <ArrowRight className="w-3 h-3 text-gray-400" />
          </Link>
          <Link
            href="/dashboard/simulation"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors shadow-xs"
          >
            <Cpu className="w-3.5 h-3.5 text-blue-500" />
            <span>Stage 1 Crisis Simulation</span>
            <ArrowRight className="w-3 h-3 text-gray-400" />
          </Link>
        </div>
      </div>

      {/* Country Selection & Control Bar */}
      <CountrySelector
        selectedCodes={selectedCodes}
        onSelectCodes={setSelectedCodes}
        availableCountries={availableCountries}
        isLoading={isAvailableLoading}
      />

      {/* Main Content Area */}
      {selectedCodes.length < 2 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <Scale className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Select at least 2 economies to begin comparison
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Choose between 2 and 5 countries using the selector above or pick a curated preset like the Top 5 Global Economies.
          </p>
        </div>
      ) : isComparisonLoading ? (
        /* Loading Skeleton */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="h-80 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
            <div className="h-80 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
          </div>
          <div className="h-96 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
        </div>
      ) : comparisonError ? (
        /* Error State */
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
            Failed to load comparative economic data
          </h3>
          <p className="text-xs text-red-600 dark:text-red-400 max-w-md mx-auto">
            {(comparisonError as Error).message || 'An error occurred while fetching comparison data.'}
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Comparison</span>
          </button>
        </div>
      ) : comparisonData ? (
        /* Loaded Success State */
        <div className="space-y-6">
          {/* Section 1: Summary Metric Cards */}
          <ComparisonSummaryCards countries={comparisonData.countries} />

          {/* Section 2: Primary Visualizations */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Real GDP Snapshot Bar Chart (4 columns) */}
            <div className="lg:col-span-5">
              <GDPComparisonChart countries={comparisonData.countries} />
            </div>

            {/* Historical 2010-2025 Trajectory (7 columns) */}
            <div className="lg:col-span-7">
              <HistoricalTrendChart
                countries={comparisonData.countries}
                commonYears={comparisonData.common_years}
              />
            </div>
          </div>

          {/* Section 3: Macro Indicator Charts (Inflation & Unemployment) */}
          <MacroIndicatorCharts countries={comparisonData.countries} />

          {/* Section 4: Full Comprehensive Indicator Matrix Table */}
          <ComparisonTable countries={comparisonData.countries} />

          {/* Section 5: Data-Derived Factual Insights Panel */}
          <EconomicInsightsPanel
            observations={comparisonData.observations}
            countries={comparisonData.countries}
            dataDisclaimer={comparisonData.data_disclaimer}
          />
        </div>
      ) : null}
    </div>
  );
}
