export const SECTOR_ETFS = [
  'XLK', // Technology
  'XLF', // Financials
  'XLE', // Energy
  'XLV', // Healthcare
  'XLY', // Consumer Discretionary
  'XLP', // Consumer Staples
  'XLI', // Industrials
  'XLB', // Materials
  'XLU', // Utilities
  'XLRE', // Real Estate
  'XLC'  // Communication Services
];

// Mega-cap universe for calculating market breadth to avoid massive rate limits
export const BREADTH_UNIVERSE = [
  'AAPL',
  'MSFT',
  'AMZN',
  'GOOGL',
  'META',
  'TSLA',
  'BRK-B', // Usually Yahoo Finance uses BRK-B instead of BRK.B
  'JPM',
  'JNJ',
  'V',
  'UNH',
  'HD',
  'PG',
  'MA',
  'DIS'
];
