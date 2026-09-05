// src/modules/market/transformers/quoteNormalizer.js
// Canonical quote normalizer: maps raw provider data → canonical schema,
// merges multi-provider results, computes derived metrics and data quality.

import {
  isMissing, parseNumber, parseYahooNumber, parsePercentage,
  parseCompactNumber, parseBidAsk, parseDate, validOrNull,
  isValidValue, safeDivide
} from './quoteUtils.js';

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

// Fields that are actual quote data (counted for data quality)
const QUOTE_FIELDS = [
  'symbol', 'name', 'exchange', 'exchangeTimezone', 'currency', 'quoteType',
  'price', 'regularMarketPrice', 'current_price',
  'change', 'regularMarketChange', 'changePercent', 'regularMarketChangePercent',
  'preMarketPrice', 'preMarketChange', 'preMarketChangePercent',
  'afterHoursPrice', 'afterHoursChange', 'afterHoursChangePercent',
  'marketState', 'tradeTime',
  'previousClose', 'open', 'high', 'low', 'dayHigh', 'dayLow',
  'bid', 'bidSize', 'ask', 'askSize',
  'bidAskSpread', 'bidAskSpreadPercent',
  'volume', 'averageVolume', 'averageVolume10Day', 'averageVolume3Month',
  'volumeVsAverage', 'volumeRatio',
  'intradayRange', 'intradayRangePercent',
  'fiftyTwoWeekHigh', 'fiftyTwoWeekLow', 'fiftyTwoWeekChange',
  'fiftyDayAverage', 'twoHundredDayAverage',
  'marketCap', 'enterpriseValue', 'beta',
  'peRatio', 'trailingPE', 'forwardPE', 'pegRatio',
  'eps', 'epsTTM', 'dilutedEPS',
  'priceToSales', 'priceToBook', 'enterpriseValueToRevenue', 'enterpriseValueToEBITDA',
  'dividendRate', 'dividendYield', 'exDividendDate', 'dividendDate',
  'earningsDate', 'earningsTimestamp',
  'revenue', 'netIncome', 'profitMargin', 'operatingMargin',
  'returnOnAssets', 'returnOnEquity',
  'totalCash', 'totalDebt', 'debtToEquity', 'leveredFreeCashFlow',
  'sector', 'industry', 'description', 'employees',
  'analystRating', 'targetMeanPrice', 'targetLowPrice', 'targetHighPrice', 'numberOfAnalystOpinions'
];

// Metadata fields (not counted for data quality)
const META_FIELDS = [
  'performance', 'benchmarkPerformance', 'alpha',
  'dataQuality', 'fieldSources', 'source', 'timestamp', 'updatedAt'
];

/**
 * Creates an empty canonical quote object with all fields set to null.
 */
export function createCanonicalQuote() {
  const quote = {};
  for (const field of QUOTE_FIELDS) {
    quote[field] = null;
  }
  // Initialize nested structures
  quote.performance = createPerformanceStub();
  quote.benchmarkPerformance = createBenchmarkStub();
  quote.alpha = createAlphaStub();
  quote.dataQuality = null;
  quote.fieldSources = {};
  quote.source = null;
  quote.timestamp = null;
  quote.updatedAt = null;
  return quote;
}

function createPerformanceStub() {
  return { '1d': null, '5d': null, '1m': null, '3m': null, '6m': null, 'ytd': null, '1y': null, '3y': null, '5y': null, 'all': null };
}

function createBenchmarkStub() {
  return { benchmark: 'S&P 500', symbol: '^GSPC', '1d': null, '5d': null, '1m': null, '3m': null, '6m': null, 'ytd': null, '1y': null, '3y': null, '5y': null, 'all': null };
}

function createAlphaStub() {
  return { '1d': null, '5d': null, '1m': null, '3m': null, '6m': null, 'ytd': null, '1y': null, '3y': null, '5y': null };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER NORMALIZERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize raw provider data into the canonical schema.
 * @param {string} provider - 'twelvedata' | 'yahoo' | 'finnhub'
 * @param {object} rawData - Raw API response
 * @param {string} symbol - Stock symbol
 * @returns {object} Canonical quote object
 */
export function normalizeQuote(provider, rawData, symbol) {
  if (!rawData) return createCanonicalQuote();

  switch (provider) {
    case 'twelvedata':
      return normalizeTwelveData(rawData, symbol);
    case 'alphavantage':
      return normalizeAlphaVantage(rawData, symbol);
    case 'sec':
      return normalizeSec(rawData, symbol);
    case 'yahoo':
      return normalizeYahoo(rawData, symbol);
    case 'finnhub':
      return normalizeFinnhub(rawData, symbol);
    default:
      return createCanonicalQuote();
  }
}

// ── TwelveData ───────────────────────────────────────────────────────────────

function normalizeTwelveData(raw, symbol) {
  const q = createCanonicalQuote();

  q.symbol = raw.symbol || symbol;
  q.name = validOrNull(raw.name);
  q.exchange = validOrNull(raw.exchange);
  q.exchangeTimezone = validOrNull(raw.exchange_timezone);
  q.currency = validOrNull(raw.currency);
  q.quoteType = validOrNull(raw.type);

  const price = parseNumber(raw.close) ?? parseNumber(raw.price);
  q.price = price;
  q.regularMarketPrice = price;
  q.current_price = price;

  q.change = parseNumber(raw.change);
  q.regularMarketChange = parseNumber(raw.change);
  q.changePercent = parseNumber(raw.percent_change);
  q.regularMarketChangePercent = parseNumber(raw.percent_change);

  q.previousClose = parseNumber(raw.previous_close);
  q.open = parseNumber(raw.open);
  q.high = parseNumber(raw.high);
  q.low = parseNumber(raw.low);
  q.dayHigh = parseNumber(raw.high);
  q.dayLow = parseNumber(raw.low);

  q.volume = parseNumber(raw.volume);
  q.averageVolume = parseNumber(raw.average_volume);

  if (raw.fifty_two_week) {
    q.fiftyTwoWeekHigh = parseNumber(raw.fifty_two_week.high);
    q.fiftyTwoWeekLow = parseNumber(raw.fifty_two_week.low);
    q.fiftyTwoWeekChange = parseNumber(raw.fifty_two_week.change);
  }

  q.marketCap = parseNumber(raw.market_cap);
  q.beta = parseNumber(raw.beta);
  q.peRatio = parseNumber(raw.pe);
  q.eps = parseNumber(raw.eps);
  q.dividendYield = parseNumber(raw.dividend_yield);

  q.timestamp = raw.timestamp
    ? parseDate(raw.timestamp)
    : new Date().toISOString();

  // Field As Of tracking
  q.fieldAsOf = {};
  for (const field of QUOTE_FIELDS) {
    if (_isFieldValid(q[field], field)) {
      q.fieldAsOf[field] = q.timestamp;
    }
  }

  return q;
}

// ── Alpha Vantage ────────────────────────────────────────────────────────────

function normalizeAlphaVantage(raw, symbol) {
  const q = createCanonicalQuote();
  q.symbol = raw.Symbol || symbol;
  
  q.marketCap = parseNumber(raw.MarketCapitalization);
  q.beta = parseNumber(raw.Beta);
  q.peRatio = parseNumber(raw.PERatio);
  q.forwardPE = parseNumber(raw.ForwardPE);
  q.trailingPE = parseNumber(raw.TrailingPE);
  q.pegRatio = parseNumber(raw.PEGRatio);
  q.priceToBook = parseNumber(raw.PriceToBookRatio);
  q.priceToSales = parseNumber(raw.PriceToSalesRatioTTM);
  q.enterpriseValueToEBITDA = parseNumber(raw.EVToEBITDA);
  q.enterpriseValueToRevenue = parseNumber(raw.EVToRevenue);
  
  q.eps = parseNumber(raw.EPS);
  q.dilutedEPS = parseNumber(raw.DilutedEPSTTM);
  q.epsTTM = q.dilutedEPS || q.eps;
  
  q.revenue = parseNumber(raw.RevenueTTM);
  q.netIncome = parseNumber(raw.GrossProfitTTM); // AV doesn't give plain net income in OVERVIEW
  q.profitMargin = parseNumber(raw.ProfitMargin);
  q.operatingMargin = parseNumber(raw.OperatingMarginTTM);
  q.returnOnAssets = parseNumber(raw.ReturnOnAssetsTTM);
  q.returnOnEquity = parseNumber(raw.ReturnOnEquityTTM);
  q.enterpriseValue = parseNumber(raw.EBITDA); // AV gives EBITDA, we might map EV differently if available
  
  q.dividendYield = parseNumber(raw.DividendYield);
  q.dividendRate = parseNumber(raw.DividendPerShare);
  q.exDividendDate = parseDate(raw.ExDividendDate);
  q.dividendDate = parseDate(raw.DividendDate);
  
  q.fiftyTwoWeekHigh = parseNumber(raw['52WeekHigh']);
  q.fiftyTwoWeekLow = parseNumber(raw['52WeekLow']);
  q.fiftyDayAverage = parseNumber(raw['50DayMovingAverage']);
  q.twoHundredDayAverage = parseNumber(raw['200DayMovingAverage']);
  
  q.targetMeanPrice = parseNumber(raw.AnalystTargetPrice);
  
  q.sector = validOrNull(raw.Sector);
  q.industry = validOrNull(raw.Industry);
  q.description = validOrNull(raw.Description);
  q.name = validOrNull(raw.Name);
  q.exchange = validOrNull(raw.Exchange);
  q.currency = validOrNull(raw.Currency);
  
  q.timestamp = new Date().toISOString();
  
  q.fieldAsOf = {};
  for (const field of QUOTE_FIELDS) {
    if (_isFieldValid(q[field], field)) {
      q.fieldAsOf[field] = q.timestamp; 
    }
  }

  return q;
}

// ── SEC EDGAR ────────────────────────────────────────────────────────────────

function normalizeSec(raw, symbol) {
  const q = createCanonicalQuote();
  q.symbol = raw.symbol || symbol;
  q.fieldAsOf = {};
  
  if (!raw.facts) return q;
  
  // Helper to get the most recent fact from an array
  const getLatestFact = (factArray) => {
    if (!factArray || !Array.isArray(factArray) || factArray.length === 0) return null;
    // Filter for 10-K or 10-Q
    const valid = factArray.filter(f => f.form === '10-K' || f.form === '10-Q');
    if (valid.length === 0) return null;
    return valid.sort((a, b) => new Date(b.end) - new Date(a.end))[0];
  };

  const getFactValue = (conceptNames) => {
    for (const name of conceptNames) {
      const factNode = raw.facts[name];
      if (factNode && factNode.units && factNode.units.USD) {
        const latest = getLatestFact(factNode.units.USD);
        if (latest && typeof latest.val === 'number') {
          return { val: latest.val, asOf: latest.end || latest.filed };
        }
      } else if (factNode && factNode.units && factNode.units.shares) {
         const latest = getLatestFact(factNode.units.shares);
         if (latest && typeof latest.val === 'number') {
            return { val: latest.val, asOf: latest.end || latest.filed };
         }
      }
    }
    return null;
  };

  const setField = (field, conceptNames) => {
    const res = getFactValue(conceptNames);
    if (res) {
      q[field] = res.val;
      q.fieldAsOf[field] = res.asOf;
    }
  };

  setField('revenue', ['Revenues', 'SalesRevenueNet', 'RevenueFromContractWithCustomerExcludingAssessedTax']);
  setField('netIncome', ['NetIncomeLoss']);
  setField('totalCash', ['CashAndCashEquivalentsAtCarryingValue']);
  setField('totalDebt', ['LongTermDebt', 'DebtCurrent']); // Simplified
  
  // Other potential fields from SEC:
  // OperatingIncomeLoss, GrossProfit, Assets, Liabilities, StockholdersEquity, NetCashProvidedByOperatingActivities
  
  const epsRes = getFactValue(['EarningsPerShareBasic']);
  if (epsRes) { q.eps = epsRes.val; q.fieldAsOf.eps = epsRes.asOf; }
  
  const dilutedEpsRes = getFactValue(['EarningsPerShareDiluted']);
  if (dilutedEpsRes) { q.dilutedEPS = dilutedEpsRes.val; q.fieldAsOf.dilutedEPS = dilutedEpsRes.asOf; }

  q.timestamp = new Date().toISOString();
  return q;
}

// ── Yahoo Finance ────────────────────────────────────────────────────────────

function normalizeYahoo(raw, symbol) {
  const q = createCanonicalQuote();

  // Yahoo quoteSummary returns nested modules. Flatten them.
  // If the caller already flattened, handle both shapes.
  const price = raw.price || raw;
  const summaryDetail = raw.summaryDetail || raw;
  const keyStats = raw.defaultKeyStatistics || raw;
  const financialData = raw.financialData || raw;
  const profile = raw.assetProfile || raw;
  const earnings = raw.earnings || {};
  const calendarEvents = raw.calendarEvents || {};

  // --- Identity ---
  q.symbol = price.symbol || raw.symbol || symbol;
  q.name = validOrNull(price.shortName || price.longName || raw.shortName || raw.longName);
  q.exchange = validOrNull(price.exchangeName || price.exchange || raw.exchange);
  q.exchangeTimezone = validOrNull(price.exchangeTimezoneShortName || raw.exchangeTimezoneShortName);
  q.currency = validOrNull(price.currency || raw.currency);
  q.quoteType = validOrNull(price.quoteType || raw.quoteType);

  // --- Price ---
  const mktPrice = _yahooNum(price.regularMarketPrice) ?? _yahooNum(raw.regularMarketPrice);
  q.price = mktPrice;
  q.regularMarketPrice = mktPrice;
  q.current_price = mktPrice;

  q.change = _yahooNum(price.regularMarketChange) ?? _yahooNum(raw.regularMarketChange);
  q.regularMarketChange = q.change;
  q.changePercent = _yahooNum(price.regularMarketChangePercent) ?? _yahooNum(raw.regularMarketChangePercent);
  q.regularMarketChangePercent = q.changePercent;

  // --- Pre/After Market ---
  q.preMarketPrice = _yahooNum(price.preMarketPrice) ?? _yahooNum(raw.preMarketPrice);
  q.preMarketChange = _yahooNum(price.preMarketChange) ?? _yahooNum(raw.preMarketChange);
  q.preMarketChangePercent = _yahooNum(price.preMarketChangePercent) ?? _yahooNum(raw.preMarketChangePercent);

  q.afterHoursPrice = _yahooNum(price.postMarketPrice) ?? _yahooNum(raw.postMarketPrice);
  q.afterHoursChange = _yahooNum(price.postMarketChange) ?? _yahooNum(raw.postMarketChange);
  q.afterHoursChangePercent = _yahooNum(price.postMarketChangePercent) ?? _yahooNum(raw.postMarketChangePercent);

  q.marketState = validOrNull(price.marketState || raw.marketState);
  q.tradeTime = parseDate(price.regularMarketTime) ?? parseDate(raw.regularMarketTime);

  // --- OHLC ---
  q.previousClose = _yahooNum(summaryDetail.previousClose) ?? _yahooNum(raw.regularMarketPreviousClose);
  q.open = _yahooNum(summaryDetail.open) ?? _yahooNum(raw.regularMarketOpen);

  const dayHigh = _yahooNum(summaryDetail.dayHigh) ?? _yahooNum(raw.regularMarketDayHigh);
  q.dayHigh = dayHigh;
  q.high = dayHigh;

  const dayLow = _yahooNum(summaryDetail.dayLow) ?? _yahooNum(raw.regularMarketDayLow);
  q.dayLow = dayLow;
  q.low = dayLow;

  // --- Bid/Ask ---
  q.bid = _yahooNum(summaryDetail.bid) ?? _yahooNum(raw.bid);
  q.bidSize = _yahooNum(summaryDetail.bidSize) ?? _yahooNum(raw.bidSize);
  q.ask = _yahooNum(summaryDetail.ask) ?? _yahooNum(raw.ask);
  q.askSize = _yahooNum(summaryDetail.askSize) ?? _yahooNum(raw.askSize);

  // --- Volume ---
  q.volume = _yahooNum(summaryDetail.volume) ?? _yahooNum(raw.regularMarketVolume);
  q.averageVolume = _yahooNum(summaryDetail.averageVolume) ?? _yahooNum(raw.averageVolume);
  q.averageVolume10Day = _yahooNum(summaryDetail.averageVolume10days) ?? _yahooNum(raw.averageDailyVolume10Day);
  q.averageVolume3Month = _yahooNum(summaryDetail.averageDailyVolume3Month) ?? _yahooNum(raw.averageDailyVolume3Month);

  // --- 52-week ---
  q.fiftyTwoWeekHigh = _yahooNum(summaryDetail.fiftyTwoWeekHigh) ?? _yahooNum(raw.fiftyTwoWeekHigh);
  q.fiftyTwoWeekLow = _yahooNum(summaryDetail.fiftyTwoWeekLow) ?? _yahooNum(raw.fiftyTwoWeekLow);
  q.fiftyTwoWeekChange = _yahooNum(keyStats.fiftyTwoWeekChange) ?? _yahooNum(raw['52WeekChange']);

  // --- Moving Averages ---
  q.fiftyDayAverage = _yahooNum(summaryDetail.fiftyDayAverage) ?? _yahooNum(raw.fiftyDayAverage);
  q.twoHundredDayAverage = _yahooNum(summaryDetail.twoHundredDayAverage) ?? _yahooNum(raw.twoHundredDayAverage);

  // --- Valuation ---
  q.marketCap = _yahooNum(summaryDetail.marketCap) ?? _yahooNum(raw.marketCap);
  q.enterpriseValue = _yahooNum(keyStats.enterpriseValue) ?? _yahooNum(raw.enterpriseValue);
  q.beta = _yahooNum(summaryDetail.beta) ?? _yahooNum(keyStats.beta) ?? _yahooNum(raw.beta);

  q.trailingPE = _yahooNum(summaryDetail.trailingPE) ?? _yahooNum(raw.trailingPE);
  q.forwardPE = _yahooNum(summaryDetail.forwardPE) ?? _yahooNum(keyStats.forwardPE) ?? _yahooNum(raw.forwardPE);
  q.peRatio = q.trailingPE ?? q.forwardPE;
  q.pegRatio = _yahooNum(keyStats.pegRatio) ?? _yahooNum(raw.pegRatio);

  q.eps = _yahooNum(keyStats.trailingEps) ?? _yahooNum(raw.epsTrailingTwelveMonths);
  q.epsTTM = q.eps;
  q.dilutedEPS = _yahooNum(financialData.dilutedEPS) ?? _yahooNum(raw.dilutedEPS);

  q.priceToSales = _yahooNum(keyStats.priceToSalesTrailing12Months) ?? _yahooNum(raw.priceToSalesTrailing12Months);
  q.priceToBook = _yahooNum(keyStats.priceToBook) ?? _yahooNum(raw.priceToBook);
  q.enterpriseValueToRevenue = _yahooNum(keyStats.enterpriseToRevenue) ?? _yahooNum(raw.enterpriseToRevenue);
  q.enterpriseValueToEBITDA = _yahooNum(keyStats.enterpriseToEbitda) ?? _yahooNum(raw.enterpriseToEbitda);

  // --- Dividends ---
  q.dividendRate = _yahooNum(summaryDetail.dividendRate) ?? _yahooNum(raw.dividendRate);
  q.dividendYield = _yahooNum(summaryDetail.dividendYield) ?? _yahooNum(raw.dividendYield);
  q.exDividendDate = parseDate(summaryDetail.exDividendDate) ?? parseDate(keyStats.lastDividendDate) ?? parseDate(raw.exDividendDate);
  q.dividendDate = parseDate(calendarEvents.dividendDate) ?? parseDate(raw.dividendDate);

  // --- Earnings ---
  const earningsDates = calendarEvents.earnings?.earningsDate || raw.earningsDate;
  if (Array.isArray(earningsDates) && earningsDates.length > 0) {
    q.earningsDate = parseDate(earningsDates[0]);
  } else {
    q.earningsDate = parseDate(earningsDates);
  }
  q.earningsTimestamp = _yahooNum(raw.earningsTimestamp) ?? _yahooNum(calendarEvents.earnings?.earningsDate?.[0]);

  // --- Financials ---
  q.revenue = _yahooNum(financialData.totalRevenue) ?? _yahooNum(raw.totalRevenue);
  q.netIncome = _yahooNum(financialData.netIncomeToCommon) ?? _yahooNum(raw.netIncomeToCommon);
  q.profitMargin = _yahooPercentField(financialData.profitMargins) ?? _yahooPercentField(raw.profitMargins);
  q.operatingMargin = _yahooPercentField(financialData.operatingMargins) ?? _yahooPercentField(raw.operatingMargins);
  q.returnOnAssets = _yahooPercentField(financialData.returnOnAssets) ?? _yahooPercentField(raw.returnOnAssets);
  q.returnOnEquity = _yahooPercentField(financialData.returnOnEquity) ?? _yahooPercentField(raw.returnOnEquity);

  // --- Balance Sheet ---
  q.totalCash = _yahooNum(financialData.totalCash) ?? _yahooNum(raw.totalCash);
  q.totalDebt = _yahooNum(financialData.totalDebt) ?? _yahooNum(raw.totalDebt);
  q.debtToEquity = _yahooNum(financialData.debtToEquity) ?? _yahooNum(raw.debtToEquity);
  q.leveredFreeCashFlow = _yahooNum(financialData.freeCashflow) ?? _yahooNum(raw.freeCashflow) ?? _yahooNum(raw.leveredFreeCashFlow);

  // --- Profile ---
  q.sector = validOrNull(profile.sector || raw.sector);
  q.industry = validOrNull(profile.industry || raw.industry);
  q.description = validOrNull(profile.longBusinessSummary || raw.longBusinessSummary);
  q.employees = _yahooNum(profile.fullTimeEmployees) ?? _yahooNum(raw.fullTimeEmployees);

  // --- Analyst ---
  q.analystRating = validOrNull(financialData.recommendationKey || raw.recommendationKey);
  q.targetMeanPrice = _yahooNum(financialData.targetMeanPrice) ?? _yahooNum(raw.targetMeanPrice);
  q.targetLowPrice = _yahooNum(financialData.targetLowPrice) ?? _yahooNum(raw.targetLowPrice);
  q.targetHighPrice = _yahooNum(financialData.targetHighPrice) ?? _yahooNum(raw.targetHighPrice);
  q.numberOfAnalystOpinions = _yahooNum(financialData.numberOfAnalystOpinions) ?? _yahooNum(raw.numberOfAnalystOpinions);

  q.timestamp = parseDate(price.regularMarketTime) ?? parseDate(raw.regularMarketTime) ?? new Date().toISOString();

  return q;
}

/**
 * Helper to extract a number from Yahoo's response.
 * Yahoo-finance2 returns raw numbers or objects like { raw: 123, fmt: '123' }.
 */
function _yahooNum(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && val !== null && 'raw' in val) {
    return parseNumber(val.raw);
  }
  return parseNumber(val);
}

/**
 * Yahoo returns margin/return ratios as decimals (0.6366 = 63.66%).
 * Convert to percentage for the canonical schema.
 */
function _yahooPercentField(val) {
  const num = _yahooNum(val);
  if (num === null) return null;
  // If it's already > 1, it's likely already a percentage
  if (Math.abs(num) > 1) return num;
  // Convert decimal to percentage
  return +(num * 100).toFixed(4);
}

// ── Finnhub ──────────────────────────────────────────────────────────────────

function normalizeFinnhub(raw, symbol) {
  const q = createCanonicalQuote();

  q.symbol = raw.symbol || symbol;

  const price = parseNumber(raw.c);
  q.price = price;
  q.regularMarketPrice = price;
  q.current_price = price;

  q.change = parseNumber(raw.d);
  q.regularMarketChange = parseNumber(raw.d);
  q.changePercent = parseNumber(raw.dp);
  q.regularMarketChangePercent = parseNumber(raw.dp);

  q.high = parseNumber(raw.h);
  q.dayHigh = parseNumber(raw.h);
  q.low = parseNumber(raw.l);
  q.dayLow = parseNumber(raw.l);
  q.open = parseNumber(raw.o);
  q.previousClose = parseNumber(raw.pc);

  q.timestamp = raw.t ? parseDate(raw.t) : new Date().toISOString();

  return q;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIELD-LEVEL MERGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merge multiple normalized quotes with field-level priority:
 *
 * Primary -> TwelveData (fast quote fields)
 * Secondary -> AlphaVantage (fundamentals + quote fallback)
 * Tertiary -> SEC (pure fundamentals)
 * Fallbacks -> Yahoo, Finnhub
 *
 * @param {object} providers - Dictionary of provider name -> normalized quote object
 * @returns {{ merged: object, fieldSources: object, providersUsed: string[], fieldAsOf: object, sourceDiscrepancies: object }}
 */
export function mergeQuoteFields(providers) {
  const merged = createCanonicalQuote();
  const fieldSources = {};
  const fieldAsOf = {};
  const providersUsed = new Set();
  const sourceDiscrepancies = {};

  // Define fallback chains per field
  const quotePriority = ['twelvedata', 'alphavantage', 'yahoo', 'finnhub'];
  const fundamentalsPriority = ['sec', 'alphavantage', 'yahoo'];
  const valuationPriority = ['alphavantage', 'yahoo', 'sec'];

  // Map each field to its optimal fallback chain
  const fieldPriorityMap = {};
  for (const field of QUOTE_FIELDS) {
    if (['revenue', 'netIncome', 'totalCash', 'totalDebt'].includes(field)) {
      fieldPriorityMap[field] = fundamentalsPriority;
    } else if (['marketCap', 'beta', 'peRatio', 'eps', 'dividendYield', 'sector', 'industry'].includes(field)) {
      fieldPriorityMap[field] = valuationPriority;
    } else {
      fieldPriorityMap[field] = quotePriority;
    }
  }

  for (const field of QUOTE_FIELDS) {
    const chain = fieldPriorityMap[field] || quotePriority;
    let chosenValue = null;
    let chosenProvider = null;
    
    // For discrepancy tracking
    const validNumericSubmissions = [];

    for (const providerName of chain) {
      const sourceObj = providers[providerName];
      if (!sourceObj) continue;
      
      const val = sourceObj[field];
      if (_isFieldValid(val, field)) {
        if (chosenValue === null) {
          chosenValue = val;
          chosenProvider = providerName;
          merged[field] = val;
          fieldSources[field] = providerName;
          fieldAsOf[field] = sourceObj.fieldAsOf?.[field] || sourceObj.timestamp;
          providersUsed.add(providerName);
        }
        
        // Track numeric values for agreement check
        if (typeof val === 'number') {
          validNumericSubmissions.push({ provider: providerName, val });
        }
      }
    }

    // Check source agreement if multiple providers submitted a numeric value
    if (validNumericSubmissions.length > 1) {
      const baseline = validNumericSubmissions[0].val;
      if (baseline !== 0) {
        for (let i = 1; i < validNumericSubmissions.length; i++) {
          const check = validNumericSubmissions[i].val;
          const diffPercent = Math.abs((check - baseline) / baseline);
          // If > 5% difference, log a discrepancy
          if (diffPercent > 0.05) {
            if (!sourceDiscrepancies[field]) sourceDiscrepancies[field] = [];
            sourceDiscrepancies[field].push({
               providerA: validNumericSubmissions[0].provider,
               valA: baseline,
               providerB: validNumericSubmissions[i].provider,
               valB: check,
               diffPercent: +(diffPercent * 100).toFixed(2)
            });
          }
        }
      }
    }
  }

  // Copy nested structures from first provider that has them
  merged.performance = providers.twelvedata?.performance || createPerformanceStub();
  merged.benchmarkPerformance = providers.twelvedata?.benchmarkPerformance || createBenchmarkStub();
  merged.alpha = createAlphaStub();
  merged.fieldSources = fieldSources;
  merged.fieldAsOf = fieldAsOf;

  return { merged, fieldSources, fieldAsOf, providersUsed: [...providersUsed], sourceDiscrepancies };
}

/**
 * Determine if a field value is valid (non-missing, non-placeholder).
 * For financial fields, 0 could be valid (e.g., change=0) or invalid (e.g., marketCap=0).
 * We treat 0 as invalid for fields where it makes no sense.
 */
const ZERO_INVALID_FIELDS = new Set([
  'price', 'regularMarketPrice', 'current_price',
  'marketCap', 'enterpriseValue', 'revenue', 'volume',
  'averageVolume', 'averageVolume10Day', 'averageVolume3Month',
  'fiftyTwoWeekHigh', 'fiftyTwoWeekLow',
  'fiftyDayAverage', 'twoHundredDayAverage',
  'totalCash', 'totalDebt', 'employees'
]);

function _isFieldValid(value, fieldName) {
  if (isMissing(value)) return false;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return false;
    if (value === 0 && ZERO_INVALID_FIELDS.has(fieldName)) return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED METRICS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute derived quote metrics after merge.
 * Mutates the quote object.
 */
export function computeDerivedMetrics(quote) {
  // Bid-Ask Spread
  if (quote.bid !== null && quote.ask !== null && quote.bid > 0 && quote.ask > 0) {
    quote.bidAskSpread = +(quote.ask - quote.bid).toFixed(4);
    const midpoint = (quote.ask + quote.bid) / 2;
    if (midpoint > 0) {
      quote.bidAskSpreadPercent = +(((quote.ask - quote.bid) / midpoint) * 100).toFixed(4);
    }
  }

  // Volume Ratio
  if (quote.volume !== null && quote.averageVolume !== null && quote.averageVolume > 0) {
    quote.volumeRatio = +(quote.volume / quote.averageVolume).toFixed(4);
    quote.volumeVsAverage = +(((quote.volume / quote.averageVolume) - 1) * 100).toFixed(2);
  }

  // Intraday Range
  if (quote.dayHigh !== null && quote.dayLow !== null) {
    quote.intradayRange = +(quote.dayHigh - quote.dayLow).toFixed(4);
    if (quote.previousClose !== null && quote.previousClose > 0) {
      quote.intradayRangePercent = +(((quote.dayHigh - quote.dayLow) / quote.previousClose) * 100).toFixed(4);
    }
  }

  // Alpha (where both stock and benchmark have values)
  if (quote.performance && quote.benchmarkPerformance) {
    const periods = ['1d', '5d', '1m', '3m', '6m', 'ytd', '1y', '3y', '5y'];
    for (const p of periods) {
      if (quote.performance[p] !== null && quote.benchmarkPerformance[p] !== null) {
        quote.alpha[p] = +(quote.performance[p] - quote.benchmarkPerformance[p]).toFixed(4);
      }
    }
  }
  
  // Calculate derived fundamental metrics if missing but underlying inputs exist
  if (quote.profitMargin === null && quote.netIncome !== null && quote.revenue !== null && quote.revenue !== 0) {
    quote.profitMargin = +(quote.netIncome / quote.revenue).toFixed(4);
    quote.fieldSources.profitMargin = 'derived';
  }
  
  if (quote.debtToEquity === null && quote.totalDebt !== null && quote.totalEquity !== null && quote.totalEquity !== 0) {
    quote.debtToEquity = +(quote.totalDebt / quote.totalEquity).toFixed(4);
    quote.fieldSources.debtToEquity = 'derived';
  }

  return quote;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA QUALITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute data quality metrics for the merged quote.
 * @param {object} quote - Merged canonical quote
 * @param {string[]} providersUsed - List of providers that contributed data
 * @param {object} sourceDiscrepancies - Any discrepancies found during merge
 * @returns {object} Data quality report
 */
export function computeDataQuality(quote, providersUsed, sourceDiscrepancies = {}) {
  const totalFields = QUOTE_FIELDS.length;
  const missingFields = [];
  let populatedFields = 0;
  
  let marketDataCount = 0;
  let fundamentalCount = 0;
  let technicalCount = 0;
  
  const marketDataFields = ['price', 'open', 'high', 'low', 'previousClose', 'volume', 'change', 'changePercent', 'bid', 'ask'];
  const fundamentalFields = ['marketCap', 'revenue', 'netIncome', 'peRatio', 'eps', 'beta', 'sector', 'dividendYield'];
  const technicalFields = ['fiftyDayAverage', 'twoHundredDayAverage', 'fiftyTwoWeekHigh', 'fiftyTwoWeekLow', 'volumeVsAverage'];

  for (const field of QUOTE_FIELDS) {
    if (_isFieldValid(quote[field], field)) {
      populatedFields++;
      if (marketDataFields.includes(field)) marketDataCount++;
      if (fundamentalFields.includes(field)) fundamentalCount++;
      if (technicalFields.includes(field)) technicalCount++;
    } else {
      missingFields.push(field);
    }
  }

  const completeness = totalFields > 0 ? +((populatedFields / totalFields) * 100).toFixed(1) : 0;
  const marketDataCompleteness = +((marketDataCount / marketDataFields.length) * 100).toFixed(1);
  const fundamentalCompleteness = +((fundamentalCount / fundamentalFields.length) * 100).toFixed(1);
  const technicalCompleteness = +((technicalCount / technicalFields.length) * 100).toFixed(1);

  let status = 'insufficient';
  if (completeness > 80) status = 'ready';
  else if (completeness > 40) status = 'partial';

  return {
    completeness,
    populatedFields,
    totalFields,
    marketDataCompleteness,
    fundamentalCompleteness,
    technicalCompleteness,
    missingFields,
    providersUsed,
    sourceDiscrepancies,
    staleFields: [],
    status
  };
}

/**
 * Build the composite source string, e.g. "twelvedata+yahoo+finnhub"
 */
export function buildSourceString(providersUsed) {
  if (!providersUsed || providersUsed.length === 0) return 'unknown';
  return providersUsed.join('+');
}
