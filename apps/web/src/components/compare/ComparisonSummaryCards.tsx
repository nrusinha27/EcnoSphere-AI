'use client';

import React from 'react';
import Link from 'next/link';
import { TrendingUp, Activity, Users, Globe2, ArrowUpRight } from 'lucide-react';
import type { CountryComparisonProfile } from '@/lib/api/compare';
import { COUNTRY_COLOR_STYLES, formatIndicatorValue } from './compareConstants';

interface ComparisonSummaryCardsProps {
  countries: CountryComparisonProfile[];
}

export function ComparisonSummaryCards({ countries }: ComparisonSummaryCardsProps) {
  return (
    <div
      className={`grid gap-4 ${
        countries.length === 2
          ? 'grid-cols-1 md:grid-cols-2'
          : countries.length === 3
          ? 'grid-cols-1 md:grid-cols-3'
          : countries.length === 4
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'
      }`}
    >
      {countries.map((country, idx) => {
        const style = COUNTRY_COLOR_STYLES[idx % COUNTRY_COLOR_STYLES.length];
        const gdpGrowth = country.latest_indicators.gdp_growth_pct;
        const inflation = country.latest_indicators.inflation_cpi_pct;
        const unemployment = country.latest_indicators.unemployment_pct;
        const tradeOpenness = country.latest_indicators.trade_openness_pct_gdp;

        return (
          <div
            key={country.country_code}
            className={`bg-white dark:bg-gray-800 rounded-xl border-t-4 ${style.border} border-x border-b border-gray-200 dark:border-gray-700 shadow-sm p-4 flex flex-col justify-between relative overflow-hidden`}
          >
            {/* Country Header */}
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
                    {country.country_name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {country.country_code}
                    </span>
                    {country.is_core_economy && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                        Core 10
                      </span>
                    )}
                  </div>
                </div>

                {country.is_forecast_supported && (
                  <Link
                    href={`/dashboard/forecast?country=${country.country_code}`}
                    title="Run Stage 2 interactive GDP forecast model"
                    className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-2 py-1 rounded-md transition-colors"
                  >
                    <span>ML Forecast</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                )}
              </div>

              {/* Key Indicators Grid */}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60">
                {/* GDP Growth */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <TrendingUp className="w-3 h-3 text-blue-500" />
                    <span>Real GDP</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    {gdpGrowth?.value !== null && gdpGrowth?.value !== undefined ? (
                      <span className={gdpGrowth.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                        {formatIndicatorValue(gdpGrowth.value, '%')}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 font-normal">Unavailable</span>
                    )}
                  </div>
                  {gdpGrowth?.year && (
                    <div className="text-[10px] text-gray-400 font-mono">
                      Observed: {gdpGrowth.year}
                    </div>
                  )}
                </div>

                {/* Inflation CPI */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <Activity className="w-3 h-3 text-amber-500" />
                    <span>CPI Inflation</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    {inflation?.value !== null && inflation?.value !== undefined ? (
                      <span>{inflation.value.toFixed(2)}%</span>
                    ) : (
                      <span className="text-xs text-gray-400 font-normal">Unavailable</span>
                    )}
                  </div>
                  {inflation?.year && (
                    <div className="text-[10px] text-gray-400 font-mono">
                      Observed: {inflation.year}
                    </div>
                  )}
                </div>

                {/* Unemployment */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <Users className="w-3 h-3 text-purple-500" />
                    <span>Unemployment</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    {unemployment?.value !== null && unemployment?.value !== undefined ? (
                      <span>{unemployment.value.toFixed(2)}%</span>
                    ) : (
                      <span className="text-xs text-gray-400 font-normal">Unavailable</span>
                    )}
                  </div>
                  {unemployment?.year && (
                    <div className="text-[10px] text-gray-400 font-mono">
                      Observed: {unemployment.year}
                    </div>
                  )}
                </div>

                {/* Trade Openness */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <Globe2 className="w-3 h-3 text-emerald-500" />
                    <span>Trade Openness</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    {tradeOpenness?.value !== null && tradeOpenness?.value !== undefined ? (
                      <span>{tradeOpenness.value.toFixed(1)}%</span>
                    ) : (
                      <span className="text-xs text-gray-400 font-normal">Unavailable</span>
                    )}
                  </div>
                  {tradeOpenness?.year && (
                    <div className="text-[10px] text-gray-400 font-mono">
                      Observed: {tradeOpenness.year}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer data provenance */}
            <div className="mt-3 pt-2 text-[10px] text-gray-400 border-t border-gray-100 dark:border-gray-700/40 flex justify-between items-center">
              <span>Source: World Bank WDI</span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-gray-400">
                Authentic
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
