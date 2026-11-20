'use client';

import React from 'react';
import { Lightbulb, Info, Award, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { FactualObservation, CountryComparisonProfile } from '@/lib/api/compare';
import { COUNTRY_COLOR_STYLES } from './compareConstants';

interface EconomicInsightsPanelProps {
  observations: FactualObservation[];
  countries: CountryComparisonProfile[];
  dataDisclaimer: string;
}

export function EconomicInsightsPanel({
  observations,
  countries,
  dataDisclaimer,
}: EconomicInsightsPanelProps) {
  // Map country code to style
  const countryStyleMap = new Map<string, (typeof COUNTRY_COLOR_STYLES)[0]>();
  countries.forEach((c, idx) => {
    countryStyleMap.set(c.country_code, COUNTRY_COLOR_STYLES[idx % COUNTRY_COLOR_STYLES.length]);
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Data-Derived Comparative Insights
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Factual statistical observations derived directly from reported World Bank indicators
            </p>
          </div>
        </div>

        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
          Zero Fabricated Scores
        </span>
      </div>

      {/* Observations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {observations.map((obs, idx) => {
          const style = countryStyleMap.get(obs.country_code) || COUNTRY_COLOR_STYLES[0];
          const isHighest = obs.observation_type === 'highest';

          return (
            <div
              key={`${obs.indicator_name}-${obs.observation_type}-${idx}`}
              className="p-3.5 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40 flex flex-col justify-between space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {obs.indicator_name}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                    isHighest
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {isHighest ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  <span>{obs.observation_type.toUpperCase()}</span>
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-extrabold text-gray-900 dark:text-white">
                    {obs.value > 0 ? '+' : ''}
                    {obs.value.toFixed(2)}
                    {obs.unit}
                  </span>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {obs.country_name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${style.badge}`}>
                    {obs.country_code}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">Year {obs.year}</span>
                </div>
              </div>

              <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed border-t border-gray-200/50 dark:border-gray-700/50 pt-2">
                {obs.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Mandatory Scientific Governance & Non-Causal Disclaimer */}
      <div className="p-3.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 text-xs text-blue-900 dark:text-blue-200 space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-blue-800 dark:text-blue-300">
          <Info className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <span>Scientific Governance & Methodology Statement</span>
        </div>
        <p className="text-[11px] leading-relaxed text-blue-800/90 dark:text-blue-300/90">
          {dataDisclaimer}
        </p>
        <p className="text-[10px] text-blue-700/80 dark:text-blue-400/80 italic">
          Note: This dashboard performs purely descriptive historical comparisons. It does not fabricate subjective composite rankings, proprietary risk indices, or assert causal economic mechanisms between comparative indicators.
        </p>
      </div>
    </div>
  );
}
