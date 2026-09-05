import BaseProvider from './BaseProvider.js';
import YahooFinance from 'yahoo-finance2';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { normalizeQuote, normalizeHistory } from '../transformers/marketDataNormalizer.js';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Shared headers for Yahoo scraping
const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/json,xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

export default class YahooProvider extends BaseProvider {
  constructor() {
    super('yahoo');
  }

  async getQuote(symbol) {
    try {
      const result = await yahooFinance.quote(symbol);
      return normalizeQuote(result, this.name);
    } catch (error) {
      console.error(`[YahooProvider] getQuote error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getHistoricalData(symbol, range = '1mo', interval = '1d') {
    try {
      const queryOptions = { 
        period1: this._getPeriod1(range), 
        period2: new Date().toISOString().split('T')[0],
        interval 
      };
      const result = await yahooFinance.historical(symbol, queryOptions);
      return normalizeHistory(result, this.name);
    } catch (error) {
      console.error(`[YahooProvider] getHistoricalData error for ${symbol}:`, error.message);
      return null;
    }
  }

  async search(query) {
    try {
      const result = await yahooFinance.search(query);
      return result.quotes.filter(q => q.quoteType === 'EQUITY' || q.quoteType === 'ETF');
    } catch (error) {
      return [];
    }
  }

  async getMovers() {
    try {
      const result = await yahooFinance.trendingSymbols('US');
      const formatted = (result.quotes || []).map(q => ({
        symbol: q.symbol,
        name: q.shortName || q.symbol,
        price: q.regularMarketPrice || 0,
        change: q.regularMarketChange || 0,
        changePercent: q.regularMarketChangePercent || 0,
        volume: q.regularMarketVolume || 0
      }));
      return { gainers: [], losers: [], active: formatted };
    } catch (error) {
      return { gainers: [], losers: [], active: [] };
    }
  }

  _getPeriod1(range) {
    const now = new Date();
    switch (range) {
      case '1D': now.setDate(now.getDate() - 1); break;
      case '5D': now.setDate(now.getDate() - 5); break;
      case '1M': now.setMonth(now.getMonth() - 1); break;
      case '3M': now.setMonth(now.getMonth() - 3); break;
      case '6M': now.setMonth(now.getMonth() - 6); break;
      case '1Y': now.setFullYear(now.getFullYear() - 1); break;
      case '5Y': now.setFullYear(now.getFullYear() - 5); break;
      case '10Y': now.setFullYear(now.getFullYear() - 10); break;
      default: now.setMonth(now.getMonth() - 1);
    }
    return now.toISOString().split('T')[0];
  }

  async getFundamentals(symbol) {
    return null;
  }

  /**
   * Returns raw Yahoo Finance data for the quote aggregator.
   * Strategy: Cheerio scraper (primary) → yahoo-finance2 quoteSummary (fallback).
   * The Cheerio scraper is more reliable with Node 20 since yahoo-finance2 requires Node ≥ 22.
   */
  async getQuoteRaw(symbol) {
    const SYM = symbol.toUpperCase();

    // ── Strategy 1: Cheerio scraper (proven reliable) ────────────────
    try {
      const scraped = await this._scrapeYahooQuote(SYM);
      if (scraped && (scraped.regularMarketPrice || scraped.marketCap)) {
        console.log(`[YahooProvider] Cheerio scrape OK for ${SYM}`);
        return scraped;
      }
    } catch (err) {
      console.warn(`[YahooProvider] Cheerio scrape failed for ${SYM}:`, err.message);
    }

    // ── Strategy 2: yahoo-finance2 quoteSummary (may be rate-limited) ─
    try {
      const result = await yahooFinance.quoteSummary(SYM, {
        modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'financialData', 'assetProfile', 'calendarEvents']
      });
      if (result) {
        console.log(`[YahooProvider] quoteSummary OK for ${SYM}`);
        return result;
      }
    } catch (err) {
      console.warn(`[YahooProvider] quoteSummary failed for ${SYM}:`, err.message);
    }

    // ── Strategy 3: yahoo-finance2 simple quote ──────────────────────
    try {
      const fallback = await yahooFinance.quote(SYM);
      if (fallback) {
        console.log(`[YahooProvider] simple quote OK for ${SYM}`);
        return fallback;
      }
    } catch (err) {
      console.warn(`[YahooProvider] simple quote failed for ${SYM}:`, err.message);
    }

    return null;
  }

  /**
   * Scrapes Yahoo Finance quote + key-statistics + profile pages.
   * Returns a flat object using Yahoo-canonical field names that the
   * quoteNormalizer already knows how to map.
   */
  async _scrapeYahooQuote(symbol) {
    // Fetch the quote page (and optionally key-statistics)
    const [quoteHtml, statsHtml] = await Promise.all([
      this._fetchPage(`https://finance.yahoo.com/quote/${symbol}/`),
      this._fetchPage(`https://finance.yahoo.com/quote/${symbol}/key-statistics/`).catch(() => null)
    ]);

    if (!quoteHtml) throw new Error('Quote page fetch returned empty');

    const $ = cheerio.load(quoteHtml);

    // ── 1. Try extracting embedded JSON first (most reliable) ─────────
    const embedded = this._extractEmbeddedJSON($, symbol);

    // ── 2. DOM extraction ─────────────────────────────────────────────
    const dom = this._extractFromDOM($, symbol);

    // ── 3. Key-statistics page extraction ──────────────────────────────
    let stats = {};
    if (statsHtml) {
      const $s = cheerio.load(statsHtml);
      stats = this._extractStatsPage($s);
    }

    // ── Merge: embedded > dom > stats ────────────────────────────────
    const result = { ...stats, ...dom, ...embedded };
    result.symbol = symbol;

    return result;
  }

  /**
   * Extract data from Yahoo's embedded JSON (window.__PRELOADED_STATE__ or similar).
   */
  _extractEmbeddedJSON($, symbol) {
    const result = {};

    try {
      // Yahoo embeds JSON in various script tags
      $('script').each((_, script) => {
        const text = $(script).html() || '';

        // Look for root.App.main or similar JSON blobs
        if (text.includes('"QuoteSummaryStore"') || text.includes('"StreamDataStore"')) {
          // Try to extract the JSON
          const match = text.match(/root\.App\.main\s*=\s*({[\s\S]*?})\s*;/);
          if (match) {
            try {
              const json = JSON.parse(match[1]);
              const quoteSummary = json?.context?.dispatcher?.stores?.QuoteSummaryStore;
              if (quoteSummary) {
                this._flattenQuoteSummary(quoteSummary, result);
              }
            } catch (e) { /* JSON parse failed, continue */ }
          }
        }

        // Try FinanceConfigStore pattern
        if (text.includes('"quoteSummary"')) {
          try {
            const jsonMatch = text.match(/\{[\s\S]*"quoteSummary"[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              const qResult = parsed?.quoteSummary?.result?.[0];
              if (qResult) {
                this._flattenQuoteSummary(qResult, result);
              }
            }
          } catch (e) { /* Continue to DOM extraction */ }
        }
      });
    } catch (e) {
      // Embedded JSON extraction is optional
    }

    return result;
  }

  /**
   * Flatten a quoteSummary object into canonical Yahoo field names.
   */
  _flattenQuoteSummary(qs, target) {
    const modules = ['price', 'summaryDetail', 'defaultKeyStatistics', 'financialData', 'assetProfile', 'calendarEvents', 'earnings'];
    for (const mod of modules) {
      if (qs[mod]) {
        target[mod] = qs[mod];
      }
    }
  }

  /**
   * Extract data from DOM using fin-streamer elements and stats tables/lists.
   * 
   * IMPORTANT: Yahoo's current HTML structure (2024+):
   * - Quote-specific fin-streamers have NO data-symbol attr (only market bar has them)
   * - Summary stats are in <li> where children()[0]=label, children()[1]=value
   * - Financial highlights are in <li> with <span>/<p> pairs (still works)
   */
  _extractFromDOM($, symbol) {
    const result = {};

    // ── fin-streamer elements WITHOUT data-symbol = quote-specific stats ──
    // These have data-field but no data-symbol attribute.
    // Market bar items have data-symbol="^GSPC" etc, so we skip those.
    const streamerMap = {};
    $('fin-streamer').each((_, el) => {
      const field = $(el).attr('data-field');
      const sym = $(el).attr('data-symbol');
      if (field && !sym) {
        // No data-symbol = this is a quote-specific stat
        const text = $(el).text().replace(/[(),%]/g, '').replace(/,/g, '').trim();
        if (text && !streamerMap[field]) {
          // Take the first occurrence for each field
          streamerMap[field] = text;
        }
      }
    });

    // Map fin-streamer fields to result
    if (streamerMap.regularMarketPreviousClose) {
      const n = parseFloat(streamerMap.regularMarketPreviousClose);
      if (!isNaN(n)) result.regularMarketPreviousClose = n;
    }
    if (streamerMap.regularMarketOpen) {
      const n = parseFloat(streamerMap.regularMarketOpen);
      if (!isNaN(n)) result.regularMarketOpen = n;
    }
    if (streamerMap.regularMarketVolume) {
      const n = parseFloat(streamerMap.regularMarketVolume);
      if (!isNaN(n)) result.regularMarketVolume = n;
    }
    if (streamerMap.averageVolume) {
      const n = parseFloat(streamerMap.averageVolume);
      if (!isNaN(n)) result.averageVolume = n;
    }
    if (streamerMap.marketCap) {
      result.marketCap = this._parseCompact(streamerMap.marketCap.replace(/,/g, ''));
    }
    if (streamerMap.trailingPE) {
      const n = parseFloat(streamerMap.trailingPE);
      if (!isNaN(n)) result.trailingPE = n;
    }
    if (streamerMap.targetMeanPrice) {
      const n = parseFloat(streamerMap.targetMeanPrice);
      if (!isNaN(n)) result.targetMeanPrice = n;
    }

    // Day's Range from fin-streamer (format: "229.63 - 234.76")
    if (streamerMap.regularMarketDayRange) {
      const parts = streamerMap.regularMarketDayRange.split('-').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        result.regularMarketDayLow = parts[0];
        result.regularMarketDayHigh = parts[1];
      }
    }

    // 52 Week Range from fin-streamer
    if (streamerMap.fiftyTwoWeekRange) {
      const parts = streamerMap.fiftyTwoWeekRange.split('-').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        result.fiftyTwoWeekLow = parts[0];
        result.fiftyTwoWeekHigh = parts[1];
      }
    }

    // ── Stats from <li> elements ─────────────────────────────────────
    // Strategy: Use direct children of <li> for summary stats (child[0]=label, child[1]=value)
    // Also scan <span>/<p> pairs for financial highlights section
    const statsMap = new Map();
    const clean = (text) => text.replace(/\s+/g, ' ').trim();

    // Table rows (if any remain in the layout)
    $('tr').each((_, row) => {
      const cells = $(row).children('td, th');
      if (cells.length >= 2) {
        const label = clean($(cells[0]).text());
        const value = clean($(cells[1]).text());
        if (label && value && label !== value) statsMap.set(label, value);
      }
    });

    // List items — try multiple strategies
    $('li').each((_, li) => {
      const children = $(li).children();
      if (children.length >= 2) {
        const label = clean($(children[0]).text());
        const value = clean($(children[1]).text());
        // Only set if label != value (avoids the label duplication from span pairs)
        if (label && value && label !== value) {
          statsMap.set(label, value);
        }
      }

      // Also try span/p pairs for financial highlights
      let items = $(li).find('span');
      if (items.length < 2) items = $(li).find('p');
      if (items.length >= 2) {
        const label = clean($(items[0]).text());
        const value = clean($(items[1]).text());
        if (label && value && label !== value) {
          statsMap.set(label, value);
        }
      }
    });

    const getStat = (label) => {
      if (statsMap.has(label)) return statsMap.get(label);
      for (const [key, value] of statsMap.entries()) {
        if (key.startsWith(label)) return value;
      }
      return null;
    };


    // Summary tab stats
    const prevClose = getStat('Previous Close');
    if (prevClose && prevClose !== 'N/A') result.regularMarketPreviousClose = parseFloat(prevClose.replace(/,/g, '')) || null;

    const openVal = getStat('Open');
    if (openVal && openVal !== 'N/A') result.regularMarketOpen = parseFloat(openVal.replace(/,/g, '')) || null;

    // Day's Range
    const dayRange = getStat("Day's Range");
    if (dayRange && dayRange !== 'N/A') {
      const parts = dayRange.split('-').map(s => parseFloat(s.trim().replace(/,/g, '')));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        result.regularMarketDayLow = parts[0];
        result.regularMarketDayHigh = parts[1];
      }
    }

    // 52 Week Range
    const range52 = getStat('52 Week Range');
    if (range52 && range52 !== 'N/A') {
      const parts = range52.split('-').map(s => parseFloat(s.trim().replace(/,/g, '')));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        result.fiftyTwoWeekLow = parts[0];
        result.fiftyTwoWeekHigh = parts[1];
      }
    }

    // Bid / Ask (format: "207.55 x 4000")
    const bidRaw = getStat('Bid');
    if (bidRaw && bidRaw !== 'N/A') {
      const bidParts = bidRaw.match(/([\d,.]+)\s*[xX×]\s*([\d,.]+)/);
      if (bidParts) {
        result.bid = parseFloat(bidParts[1].replace(/,/g, ''));
        result.bidSize = parseInt(bidParts[2].replace(/,/g, ''), 10);
      } else {
        const bidNum = parseFloat(bidRaw.replace(/,/g, ''));
        if (!isNaN(bidNum)) result.bid = bidNum;
      }
    }

    const askRaw = getStat('Ask');
    if (askRaw && askRaw !== 'N/A') {
      const askParts = askRaw.match(/([\d,.]+)\s*[xX×]\s*([\d,.]+)/);
      if (askParts) {
        result.ask = parseFloat(askParts[1].replace(/,/g, ''));
        result.askSize = parseInt(askParts[2].replace(/,/g, ''), 10);
      } else {
        const askNum = parseFloat(askRaw.replace(/,/g, ''));
        if (!isNaN(askNum)) result.ask = askNum;
      }
    }

    // Volume / Avg Volume
    const avgVol = getStat('Avg. Volume');
    if (avgVol && avgVol !== 'N/A') result.averageVolume = this._parseCompact(avgVol);

    // Market Cap
    const mktCap = getStat('Market Cap') || getStat('Market Cap (intraday)');
    if (mktCap && mktCap !== 'N/A') result.marketCap = this._parseCompact(mktCap);

    // Beta
    const betaStr = getStat('Beta (5Y Monthly)') || getStat('Beta');
    if (betaStr && betaStr !== 'N/A') {
      const betaNum = parseFloat(betaStr);
      if (!isNaN(betaNum)) result.beta = betaNum;
    }

    // PE Ratio
    const peStr = getStat('PE Ratio (TTM)') || getStat('PE Ratio');
    if (peStr && peStr !== 'N/A') {
      const peNum = parseFloat(peStr);
      if (!isNaN(peNum)) result.trailingPE = peNum;
    }

    // EPS
    const epsStr = getStat('EPS (TTM)');
    if (epsStr && epsStr !== 'N/A') {
      const epsNum = parseFloat(epsStr);
      if (!isNaN(epsNum)) result.epsTrailingTwelveMonths = epsNum;
    }

    // Earnings Date
    const earningsStr = getStat('Earnings Date');
    if (earningsStr && earningsStr !== 'N/A') result.earningsDate = earningsStr;

    // Forward Dividend & Yield
    const divStr = getStat('Forward Dividend & Yield');
    if (divStr && divStr !== 'N/A') {
      const divParts = divStr.split('(');
      if (divParts.length > 0) {
        const rate = parseFloat(divParts[0].trim());
        if (!isNaN(rate)) result.dividendRate = rate;
      }
      if (divParts.length > 1) {
        const yieldStr = divParts[1].replace(/[%)]/g, '').trim();
        const yieldNum = parseFloat(yieldStr);
        if (!isNaN(yieldNum)) result.dividendYield = yieldNum / 100; // Store as decimal for normalizer
      }
    }

    // Ex-Dividend Date
    const exDiv = getStat('Ex-Dividend Date');
    if (exDiv && exDiv !== 'N/A') result.exDividendDate = exDiv;

    // 1y Target Est
    const targetEst = getStat('1y Target Est');
    if (targetEst && targetEst !== 'N/A') {
      const targetNum = parseFloat(targetEst.replace(/,/g, ''));
      if (!isNaN(targetNum)) result.targetMeanPrice = targetNum;
    }

    // ── Valuation Measures (key-statistics page or inline) ────────────
    const evStr = getStat('Enterprise Value');
    if (evStr && evStr !== 'N/A') result.enterpriseValue = this._parseCompact(evStr);

    const fpeStr = getStat('Forward P/E');
    if (fpeStr && fpeStr !== 'N/A') { const n = parseFloat(fpeStr); if (!isNaN(n)) result.forwardPE = n; }

    const pegStr = getStat('PEG Ratio (5yr expected)') || getStat('PEG Ratio');
    if (pegStr && pegStr !== 'N/A') { const n = parseFloat(pegStr); if (!isNaN(n)) result.pegRatio = n; }

    const psStr = getStat('Price/Sales (ttm)') || getStat('Price/Sales');
    if (psStr && psStr !== 'N/A') { const n = parseFloat(psStr); if (!isNaN(n)) result.priceToSalesTrailing12Months = n; }

    const pbStr = getStat('Price/Book (mrq)') || getStat('Price/Book');
    if (pbStr && pbStr !== 'N/A') { const n = parseFloat(pbStr); if (!isNaN(n)) result.priceToBook = n; }

    const evRevStr = getStat('Enterprise Value/Revenue');
    if (evRevStr && evRevStr !== 'N/A') { const n = parseFloat(evRevStr); if (!isNaN(n)) result.enterpriseToRevenue = n; }

    const evEbitdaStr = getStat('Enterprise Value/EBITDA');
    if (evEbitdaStr && evEbitdaStr !== 'N/A') { const n = parseFloat(evEbitdaStr); if (!isNaN(n)) result.enterpriseToEbitda = n; }

    // ── Financial Highlights ──────────────────────────────────────────
    const profitStr = getStat('Profit Margin');
    if (profitStr && profitStr !== 'N/A') result.profitMargins = this._parsePercent(profitStr);

    const roaStr = getStat('Return on Assets (ttm)') || getStat('Return on Assets');
    if (roaStr && roaStr !== 'N/A') result.returnOnAssets = this._parsePercent(roaStr);

    const roeStr = getStat('Return on Equity (ttm)') || getStat('Return on Equity');
    if (roeStr && roeStr !== 'N/A') result.returnOnEquity = this._parsePercent(roeStr);

    const opMarginStr = getStat('Operating Margin (ttm)') || getStat('Operating Margin');
    if (opMarginStr && opMarginStr !== 'N/A') result.operatingMargins = this._parsePercent(opMarginStr);

    const revStr = getStat('Revenue (ttm)') || getStat('Revenue');
    if (revStr && revStr !== 'N/A') result.totalRevenue = this._parseCompact(revStr);

    const niStr = getStat('Net Income Avi to Common (ttm)') || getStat('Net Income Avi to Common') || getStat('Net Income (ttm)');
    if (niStr && niStr !== 'N/A') result.netIncomeToCommon = this._parseCompact(niStr);

    const depsStr = getStat('Diluted EPS (ttm)') || getStat('Diluted EPS');
    if (depsStr && depsStr !== 'N/A') { const n = parseFloat(depsStr); if (!isNaN(n)) result.dilutedEPS = n; }

    const cashStr = getStat('Total Cash (mrq)') || getStat('Total Cash');
    if (cashStr && cashStr !== 'N/A') result.totalCash = this._parseCompact(cashStr);

    const deStr = getStat('Total Debt/Equity (mrq)') || getStat('Total Debt/Equity');
    if (deStr && deStr !== 'N/A') { const n = parseFloat(deStr); if (!isNaN(n)) result.debtToEquity = n; }

    const fcfStr = getStat('Levered Free Cash Flow (ttm)') || getStat('Levered Free Cash Flow');
    if (fcfStr && fcfStr !== 'N/A') result.leveredFreeCashFlow = this._parseCompact(fcfStr);

    // ── 50/200 Day Moving Average ─────────────────────────────────────
    const ma50 = getStat('50-Day Moving Average');
    if (ma50 && ma50 !== 'N/A') { const n = parseFloat(ma50.replace(/,/g, '')); if (!isNaN(n)) result.fiftyDayAverage = n; }

    const ma200 = getStat('200-Day Moving Average');
    if (ma200 && ma200 !== 'N/A') { const n = parseFloat(ma200.replace(/,/g, '')); if (!isNaN(n)) result.twoHundredDayAverage = n; }

    // ── Analyst ───────────────────────────────────────────────────────
    const rating = getStat('Rating');
    if (rating && rating !== 'N/A') result.recommendationKey = rating;

    // ── Name extraction ───────────────────────────────────────────────
    const title = $('title').text();
    if (title) {
      const nameMatch = title.match(/^(.*?) \(/);
      if (nameMatch && nameMatch[1]) result.shortName = nameMatch[1].trim();
    }

    return result;
  }

  /**
   * Extract additional stats from the key-statistics page.
   */
  _extractStatsPage($) {
    const result = {};
    const statsMap = new Map();
    const clean = (text) => text.replace(/\s+/g, ' ').trim();

    $('tr').each((_, row) => {
      const cells = $(row).children('td, th');
      if (cells.length >= 2) {
        const label = clean($(cells[0]).text());
        const value = clean($(cells[1]).text());
        if (label && value && value !== 'N/A') statsMap.set(label, value);
      }
    });

    $('li').each((_, li) => {
      let items = $(li).find('span');
      if (items.length < 2) items = $(li).find('p');
      if (items.length >= 2) {
        const label = clean($(items[0]).text());
        const value = clean($(items[1]).text());
        if (label && value && value !== 'N/A') statsMap.set(label, value);
      }
    });

    // Map key-statistics fields that may not appear on the quote page
    const fieldMappings = {
      'Enterprise Value': 'enterpriseValue',
      'Forward P/E': 'forwardPE',
      'PEG Ratio (5yr expected)': 'pegRatio',
      'Price/Sales (ttm)': 'priceToSalesTrailing12Months',
      'Price/Book (mrq)': 'priceToBook',
      'Enterprise Value/Revenue': 'enterpriseToRevenue',
      'Enterprise Value/EBITDA': 'enterpriseToEbitda',
      'Profit Margin': 'profitMargins',
      'Operating Margin (ttm)': 'operatingMargins',
      'Return on Assets (ttm)': 'returnOnAssets',
      'Return on Equity (ttm)': 'returnOnEquity',
      'Revenue (ttm)': 'totalRevenue',
      'Net Income Avi to Common (ttm)': 'netIncomeToCommon',
      'Total Cash (mrq)': 'totalCash',
      'Total Debt/Equity (mrq)': 'debtToEquity',
      'Levered Free Cash Flow (ttm)': 'leveredFreeCashFlow',
      'Diluted EPS (ttm)': 'dilutedEPS',
      '52-Week Change': '52WeekChange',
      'Avg Vol (10 day)': 'averageDailyVolume10Day',
      'Avg Vol (3 month)': 'averageDailyVolume3Month',
      'Shares Outstanding': 'sharesOutstanding',
      'Float': 'floatShares',
      'Short Ratio': 'shortRatio',
      'Short % of Float': 'shortPercentOfFloat',
    };

    for (const [label, field] of Object.entries(fieldMappings)) {
      const val = statsMap.get(label);
      if (!val) continue;

      if (['enterpriseValue', 'totalRevenue', 'netIncomeToCommon', 'totalCash',
           'leveredFreeCashFlow', 'averageDailyVolume10Day', 'averageDailyVolume3Month',
           'sharesOutstanding', 'floatShares'].includes(field)) {
        result[field] = this._parseCompact(val);
      } else if (['profitMargins', 'operatingMargins', 'returnOnAssets', 'returnOnEquity',
                   '52WeekChange', 'shortPercentOfFloat'].includes(field)) {
        result[field] = this._parsePercent(val);
      } else {
        const num = parseFloat(val.replace(/,/g, ''));
        if (!isNaN(num)) result[field] = num;
      }
    }

    return result;
  }

  async _fetchPage(url) {
    try {
      const http = await import('http');
      const https = await import('https');
      const { data } = await axios.get(url, {
        headers: YAHOO_HEADERS,
        timeout: 10000,
        maxContentLength: 10 * 1024 * 1024,
        // Yahoo sends very large cookies/headers, need increased header size
        httpAgent: new http.Agent({ maxHeaderSize: 65536 }),
        httpsAgent: new https.Agent({ maxHeaderSize: 65536 })
      });
      return data;
    } catch (err) {
      console.warn(`[YahooProvider] _fetchPage failed for ${url}:`, err.message);
      return null;
    }
  }

  /**
   * Parse compact number notation: 5.56T, 302.97B, 136.89M, 45.2K
   */
  _parseCompact(text) {
    if (!text) return null;
    const cleaned = text.replace(/,/g, '').trim();
    const match = cleaned.match(/^([+-]?[\d.]+)\s*([TMBK]?)$/i);
    if (!match) { const n = parseFloat(cleaned); return isNaN(n) ? null : n; }
    let num = parseFloat(match[1]);
    if (isNaN(num)) return null;
    const suffix = match[2].toUpperCase();
    if (suffix === 'T') num *= 1e12;
    else if (suffix === 'B') num *= 1e9;
    else if (suffix === 'M') num *= 1e6;
    else if (suffix === 'K') num *= 1e3;
    return num;
  }

  /**
   * Parse percentage: "63.66%" → 0.6366 (decimal for normalizer).
   * The normalizer converts to display percentage.
   */
  _parsePercent(text) {
    if (!text) return null;
    const cleaned = text.replace(/,/g, '').replace(/%/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num / 100; // Store as decimal; normalizer × 100
  }
}

