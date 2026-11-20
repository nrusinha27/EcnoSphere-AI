'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Plus, RotateCcw, Sparkles, Check, AlertCircle } from 'lucide-react';
import type { AvailableCountryOption } from '@/lib/api/compare';
import { COUNTRY_COLOR_STYLES, PRESET_GROUPS } from './compareConstants';

interface CountrySelectorProps {
  selectedCodes: string[];
  onSelectCodes: (codes: string[]) => void;
  availableCountries: AvailableCountryOption[];
  isLoading: boolean;
}

export function CountrySelector({
  selectedCodes,
  onSelectCodes,
  availableCountries,
  isLoading,
}: CountrySelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const countryMap = useMemo(() => {
    const map = new Map<string, AvailableCountryOption>();
    availableCountries.forEach((c) => map.set(c.country_code, c));
    return map;
  }, [availableCountries]);

  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) {
      // Prioritize core economies and forecast-supported when not searching
      return availableCountries
        .filter((c) => !selectedCodes.includes(c.country_code))
        .sort((a, b) => {
          if (a.is_forecast_supported && !b.is_forecast_supported) return -1;
          if (!a.is_forecast_supported && b.is_forecast_supported) return 1;
          if (a.is_core_economy && !b.is_core_economy) return -1;
          if (!a.is_core_economy && b.is_core_economy) return 1;
          return a.country_name.localeCompare(b.country_name);
        })
        .slice(0, 30);
    }

    const q = searchQuery.toLowerCase().trim();
    return availableCountries
      .filter(
        (c) =>
          !selectedCodes.includes(c.country_code) &&
          (c.country_code.toLowerCase().includes(q) || c.country_name.toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [availableCountries, selectedCodes, searchQuery]);

  const handleAddCountry = (code: string) => {
    if (selectedCodes.length >= 5) return;
    if (selectedCodes.includes(code)) return;
    onSelectCodes([...selectedCodes, code]);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleRemoveCountry = (code: string) => {
    onSelectCodes(selectedCodes.filter((c) => c !== code));
  };

  const handleApplyPreset = (codes: string[]) => {
    // Only apply valid codes that exist in availableCountries
    const valid = codes.filter((c) => countryMap.has(c));
    onSelectCodes(valid.slice(0, 5));
  };

  const handleReset = () => {
    onSelectCodes(['USA', 'CHN', 'IND']);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-4">
      {/* Header & Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <span>Select Economies to Compare</span>
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              {selectedCodes.length} / 5 selected
            </span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Compare 2 to 5 countries across authentic World Bank macroeconomic series.
          </p>
        </div>

        {/* Action Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mr-1">
            <Sparkles className="w-3 h-3 text-amber-500" /> Presets:
          </span>
          {PRESET_GROUPS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleApplyPreset(preset.codes)}
              title={preset.description}
              className="text-xs px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium transition-colors"
            >
              {preset.name}
            </button>
          ))}
          <button
            onClick={handleReset}
            title="Reset to default (USA, CHN, IND)"
            className="text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      </div>

      {/* Selected Countries Chips */}
      <div className="flex items-center gap-2 flex-wrap min-h-[42px]">
        {selectedCodes.map((code, index) => {
          const style = COUNTRY_COLOR_STYLES[index % COUNTRY_COLOR_STYLES.length];
          const info = countryMap.get(code);
          return (
            <div
              key={code}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${style.border} ${style.bg} transition-all`}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: style.hex }}
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-900 dark:text-white leading-tight">
                  {info?.country_name || code}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                  {code}
                  {info?.is_forecast_supported && (
                    <span className="ml-1 text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                      • ML
                    </span>
                  )}
                </span>
              </div>
              {selectedCodes.length > 2 && (
                <button
                  onClick={() => handleRemoveCountry(code)}
                  className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-0.5 rounded transition-colors ml-1"
                  aria-label={`Remove ${code}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}

        {/* Add Country Dropdown Button / Input */}
        {selectedCodes.length < 5 && (
          <div ref={containerRef} className="relative inline-block">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors h-[42px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Country ({5 - selectedCodes.length} left)</span>
            </button>

            {isOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-72 max-h-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden flex flex-col">
                {/* Search Box */}
                <div className="p-2 border-b border-gray-100 dark:border-gray-700 relative">
                  <Search className="w-3.5 h-3.5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search 235 countries..."
                    autoFocus
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Country Options List */}
                <div className="overflow-y-auto max-h-60 p-1 divide-y divide-gray-50 dark:divide-gray-700/50">
                  {isLoading ? (
                    <div className="p-4 text-center text-xs text-gray-400">Loading dataset...</div>
                  ) : filteredCountries.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400">No countries found</div>
                  ) : (
                    filteredCountries.map((c) => (
                      <button
                        key={c.country_code}
                        onClick={() => handleAddCountry(c.country_code)}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors flex items-center justify-between text-xs"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {c.country_name}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {c.country_code}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {c.is_forecast_supported && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-medium">
                              ML Forecast
                            </span>
                          )}
                          {c.is_core_economy && !c.is_forecast_supported && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
                              Core
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Validation or Info Helper */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1">
        <div className="flex items-center gap-1.5">
          {selectedCodes.length < 2 ? (
            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3.5 h-3.5" /> Please select at least 2 countries to compare.
            </span>
          ) : selectedCodes.length === 5 ? (
            <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium">
              <Check className="w-3.5 h-3.5" /> Maximum 5 economies selected for comparative analysis.
            </span>
          ) : (
            <span>You can add {5 - selectedCodes.length} more economy to this comparison.</span>
          )}
        </div>

        <div className="text-[11px] text-gray-400 hidden sm:block">
          Scope: <strong className="text-gray-600 dark:text-gray-300">235</strong> Dataset Countries •{' '}
          <strong className="text-gray-600 dark:text-gray-300">10</strong> Core Economies •{' '}
          <strong className="text-gray-600 dark:text-gray-300">5</strong> Stage 2 ML Models
        </div>
      </div>
    </div>
  );
}
