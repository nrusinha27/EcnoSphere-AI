export const COUNTRY_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
];

export const COUNTRY_COLOR_STYLES = [
  {
    hex: '#3b82f6',
    border: 'border-blue-500',
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  {
    hex: '#10b981',
    border: 'border-emerald-500',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  {
    hex: '#f59e0b',
    border: 'border-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  {
    hex: '#8b5cf6',
    border: 'border-purple-500',
    bg: 'bg-purple-500/10',
    text: 'text-purple-600 dark:text-purple-400',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  },
  {
    hex: '#ec4899',
    border: 'border-pink-500',
    bg: 'bg-pink-500/10',
    text: 'text-pink-600 dark:text-pink-400',
    badge: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  },
];

export const PRESET_GROUPS = [
  {
    id: 'top5',
    name: 'Top 5 Economies',
    codes: ['USA', 'CHN', 'JPN', 'DEU', 'IND'],
    description: 'Largest global economies by nominal GDP',
  },
  {
    id: 'forecast_ready',
    name: 'Stage 2 ML Models',
    codes: ['USA', 'CHN', 'IND', 'GBR', 'JPN'],
    description: 'Countries supported by the Phase 11 production forecasting model',
  },
  {
    id: 'g7',
    name: 'G7 Major Economies',
    codes: ['USA', 'GBR', 'DEU', 'FRA', 'JPN'],
    description: 'Advanced democratic industrial economies',
  },
  {
    id: 'brics',
    name: 'Emerging Giants',
    codes: ['BRA', 'IND', 'CHN', 'ZAF', 'IDN'],
    description: 'Leading emerging market and developing economies',
  },
];

export const INDICATOR_CATEGORIES = [
  {
    id: 'growth',
    name: 'Economic Growth',
    indicators: [
      { key: 'gdp_growth_pct', name: 'Real GDP Growth Rate', unit: '%' },
      { key: 'gdp_current_usd', name: 'Nominal GDP (Current USD)', unit: 'USD' },
    ],
  },
  {
    id: 'labor_inflation',
    name: 'Inflation & Employment',
    indicators: [
      { key: 'inflation_cpi_pct', name: 'Consumer Price Inflation', unit: '%' },
      { key: 'unemployment_pct', name: 'Total Unemployment Rate', unit: '%' },
    ],
  },
  {
    id: 'fiscal',
    name: 'Fiscal & External Balances',
    indicators: [
      { key: 'govt_debt_pct_gdp', name: 'Government Debt to GDP', unit: '% of GDP' },
      { key: 'tax_revenue_pct_gdp', name: 'Tax Revenue to GDP', unit: '% of GDP' },
      { key: 'current_account_pct_gdp', name: 'Current Account Balance', unit: '% of GDP' },
      { key: 'reserves_usd', name: 'Total International Reserves', unit: 'USD' },
    ],
  },
  {
    id: 'trade',
    name: 'International Trade Integration',
    indicators: [
      { key: 'exports_pct_gdp', name: 'Exports of Goods & Services', unit: '% of GDP' },
      { key: 'imports_pct_gdp', name: 'Imports of Goods & Services', unit: '% of GDP' },
      { key: 'trade_balance_pct_gdp', name: 'Net Trade Balance', unit: '% of GDP' },
      { key: 'trade_openness_pct_gdp', name: 'Trade Openness Index', unit: '% of GDP' },
    ],
  },
];

export function formatIndicatorValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'Data unavailable';
  }

  if (unit === 'USD') {
    if (Math.abs(value) >= 1e12) {
      return `$${(value / 1e12).toFixed(2)} Trillion`;
    }
    if (Math.abs(value) >= 1e9) {
      return `$${(value / 1e9).toFixed(2)} Billion`;
    }
    if (Math.abs(value) >= 1e6) {
      return `$${(value / 1e6).toFixed(2)} Million`;
    }
    return `$${value.toLocaleString()}`;
  }

  if (unit === '%' || unit === '% of GDP') {
    const formatted = value.toFixed(2);
    return `${value > 0 ? '+' : ''}${formatted}${unit === '%' ? '%' : ' % of GDP'}`;
  }

  return `${value.toFixed(2)} ${unit}`;
}
