// src/services/twelveDataService.js
import axios from "axios";
import * as cheerio from "cheerio";
import https from "https";
import fs from "fs";
import path from "path";
// Robust Yahoo Finance Initialization

import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance(); // ✅ REQUIRED

import finnhub from "finnhub";
// import {
//   calculateSMA,
//   calculateEMA,
//   calculateRSI,
//   calculateMACD,
//   calculateBollingerBands
// } from "../utils/indicators.js";

// list of symbols you want
const SYMBOLS = [
  "INTC", "MSFT", "CSCO", "KHC", "VRTX", "MNST", "CTAS", "ADSK", "GILD", "GOOGL",
  "ADBE", "QCOM", "WBD", "AMAT", "CDNS", "MCHP", "ISRG", "PAYX", "AAPL", "FAST",
  "PCAR", "AMZN", "ROST", "COST", "LRCX", "INTU", "CTSH", "KLAC", "AMGN", "EA",
  "BIIB", "NVDA", "SBUX", "AXON", "CMCSA", "MRVL", "ADI", "XEL", "CSX", "EXC",
  "MU", "MAR", "HON", "AMD", "BKR", "PEP", "ADP", "KDP",
  "NFLX", "BKNG", "ORLY", "ROP", "NXPI", "TSLA", "TTWO", "CHTR", "CSGP",
  "DXCM", "FTNT", "IDXX", "MELI", "MSTR", "ON", "TMUS", "META", "WDAY", "MDLZ",
  "LULU", "REGN", "AZN", "ASML", "CPRT", "SNPS", "VRSK", "FANG", "PANW",
  "CDW", "GOOG", "SHOP", "PYPL", "TEAM", "ZS", "DDOG",
  "PLTR", "ABNB", "DASH", "APP", "GFS", "ARM", "LIN", "TRI"
];

// ---------------------------------------------------------
// ---------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------

// Finnhub Config
// Robust initialization to prevent server startup crashes
let finnhubClient = null; // Default to null

try {
  const api_key = finnhub.ApiClient.instance.authentications['api_key'];
  api_key.apiKey = "d518lt9r01qjia5c21p0d518lt9r01qjia5c21pg";
  finnhubClient = new finnhub.DefaultApi();
} catch (e) {
  // Fallback: Try with new DefaultApi directly if signature differs
  try {
    if (finnhub.DefaultApi) {
      finnhubClient = new finnhub.DefaultApi({
        apiKey: "d518lt9r01qjia5c21p0d518lt9r01qjia5c21pg"
      });
    }
  } catch (err2) {
    console.error("Failed to initialize Finnhub client:", e.message);
    // Do not throw, just log. Routes using it will handle null client.
  }
}

// ---------------------------------------------------------
// EXPORTED SERVICES (STOCK ONLY)
// ---------------------------------------------------------

/* ------------------------------------------------------
   1. SYMBOL SEARCH (Stocks Only)
------------------------------------------------------ */


// ⚡ Keep-alive (major speed boost on Render)
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 10
});

// ⚡ Small cache (huge real-world speed gain)
const cache = new Map();
const CACHE_TTL = 10000; // 10 sec

export async function searchSymbol(symbol) {
  const SYM = symbol.toUpperCase();
  console.log(`Scraping Yahoo Finance for ${SYM}...`);

  try {
    const url = `https://finance.yahoo.com/quote/${SYM}/`;

    // Robust headers to mimic browser
    const headers = {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/json,xml;q=0.9,*/*;q=0.8",
    };

    const start = Date.now();
    const { data } = await axios.get(url, { headers });
    const $ = cheerio.load(data);

    // 1. Core Price Data (fin-streamer) is fast, keep it.
    const getStreamer = (field) => {
      // Try matching by data-field AND data-symbol
      const el = $(`fin-streamer[data-field="${field}"][data-symbol="${SYM}"]`);
      if (el.length) return el.attr('value') || el.text().replace(/[(),%]/g, '');

      // Fallback just data-field
      const el2 = $(`fin-streamer[data-field="${field}"]`);
      return el2.attr('value') || el2.text().replace(/[(),%]/g, '');
    };


    let forecastData = {};

    const filePath = path.join(process.cwd(), "ml_service/company_3day_forecast.json");
    forecastData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    const currentPrice = parseFloat(getStreamer("regularMarketPrice"));
    const change = parseFloat(getStreamer("regularMarketChange"));
    const percentChange = parseFloat(getStreamer("regularMarketChangePercent"));
    const volume = parseFloat(getStreamer("regularMarketVolume"));

    // 2. Optimized Usage: Single Pass Extraction
    // Instead of $('*').filter(...) 25 times, we scan common containers once.
    // Yahoo Finance typically puts stats in <table> rows or lists.

    const statsMap = new Map();

    // Helper to clean text
    const clean = (text) => text.replace(/\s+/g, ' ').trim();

    // Strategy A: Scan all Table Rows (most stats are here)
    $('tr').each((i, row) => {
      const cells = $(row).children('td, th');
      if (cells.length >= 2) {
        const label = clean($(cells[0]).text());
        const value = clean($(cells[1]).text());
        if (label && value) {
          statsMap.set(label, value);
        }
      }
    });

    // Strategy B: Scan specific list items (divs/ul/li)
    // Yahoo is using <ul class="yf-..."><li><p class="label">...</p><p class="value">...</p></li></ul>
    $('li').each((i, li) => {
      // Try finding spans first (common in some views)
      let items = $(li).find('span');

      // If not enough spans, try paragraphs (Financial Highlights, Valuation uses this)
      if (items.length < 2) {
        items = $(li).find('p');
      }

      // If still nothing, try divs directly children if it's a list of divs? 
      // (Unlikely for li, but good to be safe)

      if (items.length >= 2) {
        const label = clean($(items[0]).text());
        const value = clean($(items[1]).text());
        if (label && value) {
          statsMap.set(label, value);
        }
      }
    });


    const getStat = (label) => {
      // Exact match
      if (statsMap.has(label)) return statsMap.get(label);

      // StartsWith fallback (search keys)
      for (const [key, value] of statsMap.entries()) {
        if (key.startsWith(label)) return value;
      }
      return null;
    };

    const prevClose = getStat("Previous Close");
    const open = getStat("Open");
    const dayRange = getStat("Day's Range");
    const fiftyTwoWeekRange = getStat("52 Week Range");
    const marketCap = getStat("Market Cap") || getStreamer("marketCap") || getStat("Market Cap (intraday)");
    const avgVolume = getStat("Avg. Volume");
    const peRatio = getStat("PE Ratio (TTM)");
    const eps = getStat("EPS (TTM)");
    const earningsDate = getStat("Earnings Date");
    const divYield = getStat("Forward Dividend & Yield");
    const targetEst = getStat("1y Target Est");

    // Bid/Ask might be "Bid" or "Ask"
    const bid = getStat("Bid");
    const ask = getStat("Ask");

    // Valuation Measures
    const enterpriseValue = getStat("Enterprise Value");
    const trailingPE = getStat("Trailing P/E");
    const forwardPE = getStat("Forward P/E");
    const pegRatio = getStat("PEG Ratio (5yr expected)");
    const priceSales = getStat("Price/Sales (ttm)");
    const priceBook = getStat("Price/Book (mrq)");
    const evRevenue = getStat("Enterprise Value/Revenue");
    const evEbitda = getStat("Enterprise Value/EBITDA");

    // Financial Highlights
    const profitMargin = getStat("Profit Margin");
    const returnOnAssets = getStat("Return on Assets (ttm)");
    const returnOnEquity = getStat("Return on Equity (ttm)");
    const revenue = getStat("Revenue (ttm)");
    const netIncome = getStat("Net Income Avi to Common (ttm)") || getStat("Net Income (ttm)"); // Fallback
    const dilutedEPS = getStat("Diluted EPS (ttm)");
    const totalCash = getStat("Total Cash (mrq)");
    const totalDebtEquity = getStat("Total Debt/Equity (mrq)");
    const leveredFCF = getStat("Levered Free Cash Flow (ttm)");

    // Analyst Insights
    const analystRating = getStat("Rating");
    const analystTarget = getStat("Price Target");


    // Parse ranges
    let dayLow = null, dayHigh = null;
    if (dayRange) {
      const parts = dayRange.split('-').map(s => parseFloat(s.trim()));
      if (parts.length === 2) { dayLow = parts[0]; dayHigh = parts[1]; }
    }

    let yearLow = null, yearHigh = null;
    if (fiftyTwoWeekRange) {
      const parts = fiftyTwoWeekRange.split('-').map(s => parseFloat(s.trim()));
      if (parts.length === 2) { yearLow = parts[0]; yearHigh = parts[1]; }
    }

    // Name extraction strategy: Try Title first as it is cleaner
    // Title: "NVIDIA Corporation (NVDA) Stock Price..."
    let name = SYM;
    const title = $('title').text();
    if (title) {
      const match = title.match(/^(.*?) \(/);
      if (match && match[1]) {
        name = match[1].trim();
      }
    }
    if (name === SYM) {
      // Fallback to h1 but clean it up
      const h1 = $('h1').first().text();
      // If h1 starts with Yahoo Finance, strip it
      name = h1.replace("Yahoo Finance", "").replace(/\(.*?\)/g, "").trim();
    }
    console.log(forecastData)
    const forecast = forecastData[SYM] || {};
    const result = {
      symbol: SYM,
      name: name || SYM,

      // Real-time
      current_price: currentPrice || 0,
      change: change || 0,
      percent_change: percentChange || 0,
      is_up: (change || 0) >= 0,
      currency: "USD",
      datetime: new Date().toISOString(),

      // Stats
      previous_close: parseFloat(prevClose) || 0,
      open: parseFloat(open) || 0,
      day_low: dayLow,
      day_high: dayHigh,
      fifty_two_week_low: yearLow,
      fifty_two_week_high: yearHigh,
      volume: volume || 0,
      average_volume: avgVolume,
      market_cap: marketCap,
      pe_ratio: parseFloat(peRatio),
      eps: parseFloat(eps),
      earnings_date: earningsDate,
      forward_dividend_yield: divYield,
      target_est_1y: parseFloat(targetEst),

      forecast_3day: forecast,
      // Valuation
      enterprise_value: enterpriseValue,
      trailing_pe: parseFloat(trailingPE) || 0,
      forward_pe: parseFloat(forwardPE) || 0,
      peg_ratio: parseFloat(pegRatio) || 0,
      price_to_sales: parseFloat(priceSales) || 0,
      price_to_book: parseFloat(priceBook) || 0,
      enterprise_value_to_revenue: parseFloat(evRevenue) || 0,
      enterprise_value_to_ebitda: parseFloat(evEbitda) || 0,

      // Financials
      profit_margin: profitMargin,
      return_on_assets: returnOnAssets,
      return_on_equity: returnOnEquity,
      revenue: revenue,
      net_income: netIncome,
      diluted_eps: parseFloat(dilutedEPS) || 0,
      total_cash: totalCash,
      total_debt_to_equity: totalDebtEquity,
      levered_free_cash_flow: leveredFCF,

      // Analyst
      analyst_rating: analystRating,
      analyst_price_target: analystTarget,

      // Add missing fields to match previous schema if needed (nulls)
      bid: parseFloat(bid) || 0,
      ask: parseFloat(ask) || 0,
    };

    return { Stocks: [result] };

  } catch (err) {
    console.error(`Scraping failed for ${SYM}:`, err.message);
    // Return empty but consistent structure
    return { Stocks: [] };
  }
}




/* ------------------------------------------------------
   2. REALTIME QUOTE (Comprehensive)
------------------------------------------------------ */

export async function getQuote(symbol) {
  const SYM = symbol.toUpperCase();

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const url = `https://finance.yahoo.com/quote/${SYM}/`;
      // Robust headers
      const headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/json,xml;q=0.9,*/*;q=0.8",
      };

      const { data } = await axios.get(url, { headers, timeout: 10000 });
      const $ = cheerio.load(data);

      // 1. Core Price Data
      const getStreamer = (field) => {
        const el = $(`fin-streamer[data-field="${field}"][data-symbol="${SYM}"]`);
        if (el.length) return el.attr('value') || el.text().replace(/[(),%]/g, '');
        const el2 = $(`fin-streamer[data-field="${field}"]`);
        return el2.attr('value') || el2.text().replace(/[(),%]/g, '');
      };

      const currentPrice = parseFloat(getStreamer("regularMarketPrice"));
      const change = parseFloat(getStreamer("regularMarketChange"));
      const percentChange = parseFloat(getStreamer("regularMarketChangePercent"));
      const volume = parseFloat(getStreamer("regularMarketVolume"));

      // 2. Stats Parsing
      const statsMap = new Map();
      const clean = (text) => text.replace(/\s+/g, ' ').trim();

      $('tr').each((i, row) => {
        const cells = $(row).children('td, th');
        if (cells.length >= 2) {
          const label = clean($(cells[0]).text());
          const value = clean($(cells[1]).text());
          if (label && value) statsMap.set(label, value);
        }
      });

      $('li').each((i, li) => {
        let items = $(li).find('span');
        if (items.length < 2) items = $(li).find('p');
        if (items.length >= 2) {
          const label = clean($(items[0]).text());
          const value = clean($(items[1]).text());
          if (label && value) statsMap.set(label, value);
        }
      });

      const getStat = (label) => {
        if (statsMap.has(label)) return statsMap.get(label);
        for (const [key, value] of statsMap.entries()) {
          if (key.startsWith(label)) return value;
        }
        return null;
      };

      // Fields extraction
      const prevClose = parseFloat(getStat("Previous Close")) || 0;
      const open = parseFloat(getStat("Open")) || 0;
      const dayRange = getStat("Day's Range");
      const fiftyTwoWeekRange = getStat("52 Week Range");
      const avgVolumeStr = getStat("Avg. Volume");
      const marketCapStr = getStat("Market Cap") || getStreamer("marketCap");

      const bid = getStat("Bid");
      const ask = getStat("Ask");

      const peRatio = parseFloat(getStat("PE Ratio (TTM)")) || 0;
      const eps = parseFloat(getStat("EPS (TTM)")) || 0;
      const divYieldStats = getStat("Forward Dividend & Yield");

      // Parse Ranges
      let dayLow = null, dayHigh = null;
      if (dayRange) {
        const parts = dayRange.split('-').map(s => parseFloat(s.trim()));
        if (parts.length === 2) { dayLow = parts[0]; dayHigh = parts[1]; }
      }

      let yearLow = null, yearHigh = null;
      if (fiftyTwoWeekRange) {
        const parts = fiftyTwoWeekRange.split('-').map(s => parseFloat(s.trim()));
        if (parts.length === 2) { yearLow = parts[0]; yearHigh = parts[1]; }
      }

      // Parse Dividend
      let dividendRate = 0;
      let dividendYield = 0;
      if (divYieldStats && divYieldStats !== "N/A") {
        const parts = divYieldStats.split('(');
        if (parts.length > 0) dividendRate = parseFloat(parts[0].trim()) || 0;
        if (parts.length > 1) dividendYield = parseFloat(parts[1].replace(/[%)]/g, '')) || 0;
      }

      // Name extraction
      let name = SYM;
      const title = $('title').text();
      if (title) {
        const match = title.match(/^(.*?) \(/);
        if (match && match[1]) name = match[1].trim();
      }
      if (name === SYM) {
        const h1 = $('h1').first().text();
        name = h1.replace("Yahoo Finance", "").replace(/\(.*?\)/g, "").trim();
      }

      return {
        symbol: SYM,
        name: name || SYM,
        exchange: "US",
        currency: "USD",
        datetime: new Date().toISOString(),
        logo: `https://financialmodelingprep.com/image-stock/${SYM}.png`,
        open: open,
        high: dayHigh || 0,
        low: dayLow || 0,
        previousClose: prevClose,
        volume: volume || 0,
        avgVolume3M: parseMultiplier(avgVolumeStr),
        bid: parseFloat(bid) || 0,
        bidSize: 0,
        ask: parseFloat(ask) || 0,
        askSize: 0,
        beta: parseFloat(getStat("Beta (5Y Monthly)")) || 0,
        current_price: currentPrice || 0,
        change: change || 0,
        percent_change: percentChange || 0,
        marketCap: parseMultiplier(marketCapStr),
        peRatioTTM: peRatio,
        forwardPE: parseFloat(getStat("Forward P/E")) || 0,
        epsTTM: eps,
        epsForward: 0,
        priceToBook: parseFloat(getStat("Price/Book (mrq)")) || 0,
        bookValue: parseFloat(getStat("Book Value (mrq)")) || 0,
        dividendRate: dividendRate,
        dividendYield: dividendYield,
        fiftyTwoWeekLow: yearLow || 0,
        fiftyTwoWeekHigh: yearHigh || 0,
        fiftyTwoWeekChange: 0,
        fiftyDayAverage: parseFloat(getStat("50-Day Moving Average")) || 0,
        twoHundredDayAverage: parseFloat(getStat("200-Day Moving Average")) || 0,
        recommendationKey: getStat("Rating") || "N/A",
        targetMeanPrice: parseFloat(getStat("Price Target")) || 0,
        numberOfAnalystOpinions: 0,
        description: "",
        sector: "",
      };

    } catch (err) {
      console.error(`Attempt ${attempt} getQuote('${SYM}') failed:`, err.message);
      if (attempt === 3) return null;
      await sleep(1000);
    }
  }
  return null;
}

/**
 * Batch fetch quotes for multiple symbols
 * Uses yahoo-finance2 for efficiency if available
 * @param {string[]} symbols 
 */
export async function getBatchQuotes(symbols) {
  if (!symbols || symbols.length === 0) return {};

  // Try yahoo-finance2 first for real batching
  if (!symbols || symbols.length === 0) return {};

  // Adjusted: Removed yahoo-finance2 block as import was removed.
  // Fallback to Parallel Scrape directly.

  // Fallback: Parallel Scrape (limit concurrency if needed, but for now promise.all)
  const results = await Promise.all(symbols.map(async (sym) => {
    const q = await getQuote(sym);
    if (!q) return null;

    // Map full data for Robust Price Logic in portfolioService
    return {
      symbol: sym,
      data: {
        price: q.current_price,
        last_price: q.current_price, // Alias for logic check
        bid: q.bid,
        ask: q.ask,
        previous_close: q.previousClose, // Note: getQuote returns 'previousClose' (camelCase)
        open: q.open,
        change: q.change,
        percentChange: q.percent_change,
        name: q.name
      }
    };
  }));

  const map = {};
  results.forEach(r => {
    if (r) map[r.symbol] = r.data;
  });
  return map;
}


// Helper to scrape Gainers/Losers tables (shared logic)
const parseMultiplier = (text) => {
  if (!text) return 0;
  const clean = text.replace(/,/g, '');
  const match = clean.match(/([\d.]+)([TMBK]?)/);
  if (!match) return parseFloat(clean) || 0;
  let val = parseFloat(match[1]);
  const suffix = match[2];
  if (suffix === 'T') val *= 1_000_000_000_000;
  if (suffix === 'B') val *= 1_000_000_000;
  if (suffix === 'M') val *= 1_000_000;
  if (suffix === 'K') val *= 1_000;
  return val;
};


export async function getTopMovers() {
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    };

    const [gainersRes, losersRes] = await Promise.all([
      fetch(
        "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?count=10&scrIds=day_gainers",
        { headers }
      ),
      fetch(
        "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?count=10&scrIds=day_losers",
        { headers }
      )
    ]);

    const gainersData = await gainersRes.json();
    const losersData = await losersRes.json();

    const gainers =
      gainersData?.finance?.result?.[0]?.quotes?.map((s) => ({
        ticker: s.symbol,
        price: s.regularMarketPrice,
        change: s.regularMarketChangePercent + "%",
        change_amount: s.regularMarketChange,
        volume: s.regularMarketVolume
      })) || [];

    const losers =
      losersData?.finance?.result?.[0]?.quotes?.map((s) => ({
        ticker: s.symbol,
        price: s.regularMarketPrice,
        change: s.regularMarketChangePercent + "%",
        change_amount: s.regularMarketChange,
        volume: s.regularMarketVolume
      })) || [];

    return { gainers, losers };

  } catch (error) {
    console.error("Yahoo direct API failed", error);
    return { gainers: [], losers: [] };
  }
}
export async function getTopLosers() {
  return await scrapeTopStocks("https://finance.yahoo.com/markets/stocks/losers/");
}

/* ------------------------------------------------------
   5. TOP TRENDING STOCKS (Dynamic Screener)
-
----------------------------------------------------- */

// Helper: Yahoo Implementation
// Helper: Cheerio Scraper Implementation
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeMostActiveStocks(retries = 3) {
  const url = "https://finance.yahoo.com/most-active";

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Scraping Yahoo Finance Most Actives (Attempt ${attempt}/${retries})...`);
      const headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/json,xml;q=0.9,*/*;q=0.8",
      };
      const { data } = await axios.get(url, { headers, timeout: 10000 }); // 10s timeout
      const $ = cheerio.load(data);
      const results = [];
      // [Existing Parsing Logic - Condensed for Brevity in Replacement]
      $('table tbody tr').each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length < 8) return;

        const symbol = $(cells[0]).text().trim();
        const name = $(cells[1]).text().trim();
        const rawPriceCell = $(cells[3]).text().trim();
        const priceMatch = rawPriceCell.match(/^[\d,.]+/);
        const current_price = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, '')) : 0;
        const changeText = $(cells[4]).text().trim();
        const change = parseFloat(changeText.replace(/,/g, '')) || 0;
        const percentChangeText = $(cells[5]).text().trim().replace('%', '');
        const percent_change = parseFloat(percentChangeText.replace(/,/g, '')) || 0;
        const volumeText = $(cells[6]).text().trim();

        const parseVolume = (txt) => {
          const m = txt.match(/([\d.]+)([MBT]?)/);
          if (!m) return 0;
          let val = parseFloat(m[1]);
          const suffix = m[2];
          if (suffix === 'M') val *= 1_000_000;
          if (suffix === 'B') val *= 1_000_000_000;
          if (suffix === 'T') val *= 1_000_000_000_000;
          return val;
        };
        const volume = parseVolume(volumeText);
        const marketCapText = $(cells[8]).text().trim();
        const market_cap = parseVolume(marketCapText);

        results.push({
          symbol, name, current_price, change, percent_change, volume, market_cap,
          exchange: 'N/A', datetime: new Date().toISOString(), is_up: change >= 0
        });
      });

      return results;

    } catch (err) {
      console.error(`Scraping attempt ${attempt} failed: ${err.message}`);
      if (attempt === retries) throw new Error("Failed to scrape most active stocks after retries");
      await sleep(2000); // 2s wait
    }
  }
}


export async function getMostActiveStocks() {
  try {
    const url =
      "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?count=25&scrIds=most_actives";

    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
      },
      timeout: 10000
    });

    const quotes = data?.finance?.result?.[0]?.quotes || [];

    const results = quotes.map((stock) => ({
      symbol: stock.symbol,
      name: stock.shortName || stock.longName || "",
      current_price: stock.regularMarketPrice || 0,
      change: stock.regularMarketChange || 0,
      percent_change: stock.regularMarketChangePercent || 0,
      volume: stock.regularMarketVolume || 0,
      market_cap: stock.marketCap || 0,
      exchange: stock.fullExchangeName || stock.exchange || "N/A",
      datetime: new Date().toISOString(),
      is_up: (stock.regularMarketChange || 0) >= 0
    }));

    return results;

  } catch (err) {
    console.error("Yahoo JSON API failed:", err.message);
    return [];
  }
}


export async function getTrendingStocks(filters = {}) {

  // ✅ 1. Try API (FAST + NO SCRAPING)
  let stockData = await getMostActiveStocksAPI();

  if (stockData.length > 0) {
    return stockData;
  }

  // ⚠️ 2. Fallback (only if API fails)
  console.log("Falling back to scraper...");
  let data = await scrapeMostActiveStocks();

  return data;
}


async function getMostActiveStocksAPI() {
  try {
    const url =
      "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?count=25&scrIds=most_actives";

    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
      },
      timeout: 10000
    });

    const quotes = data?.finance?.result?.[0]?.quotes || [];

    const results = quotes.map((stock) => ({
      symbol: stock.symbol,
      name: stock.shortName || stock.longName || "",
      current_price: stock.regularMarketPrice || 0,
      change: stock.regularMarketChange || 0,
      percent_change: stock.regularMarketChangePercent || 0,
      volume: stock.regularMarketVolume || 0,
      market_cap: stock.marketCap || 0,
      exchange: stock.fullExchangeName || stock.exchange || "N/A",
      datetime: new Date().toISOString(),
      is_up: (stock.regularMarketChange || 0) >= 0
    }));

    return results;

  } catch (err) {
    console.error("Yahoo API failed:", err.message);
    return [];
  }
}


const FMP_KEY = process.env.FMP_API_KEY;  // financialmodelingprep.com — 250 req/day free
const FMP_BASE = 'https://financialmodelingprep.com/stable';

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  return entry.data;
}
function setCache(key, data) { cache.set(key, { data, ts: Date.now() }); }

// ── FMP fetch — 1 request, returns full EOD history, we slice to 1 month ────
async function fetchFMP(symbol) {
  const url = `${FMP_BASE}/historical-price-eod/full`;

  const { data } = await axios.get(url, {
    params: { symbol, apikey: FMP_KEY },
    timeout: 15000,
  });

  // FMP returns either an array directly or { historical: [...] }
  const raw = Array.isArray(data) ? data : (data?.historical ?? []);

  if (!raw.length) throw new Error(`FMP: no data for ${symbol}`);

  // Filter to last 30 days — mirrors your Python snippet exactly
  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  const candles = raw
    .filter(d => new Date(d.date) >= oneMonthAgo)
    .map(d => ({
      date: d.date,
      open: parseFloat(d.open),
      high: parseFloat(d.high),
      low: parseFloat(d.low),
      close: parseFloat(d.close),
      volume: parseInt(d.volume ?? 0, 10),
    }))
    .filter(d => !isNaN(d.close) && d.close > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!candles.length) throw new Error(`FMP: no candles in last 30 days for ${symbol}`);
  return candles;
}

// ── Resample daily → weekly / monthly (no extra API call) ────────────────────
function resampleCandles(dailyCandles, period) {
  const buckets = new Map();
  dailyCandles.forEach(c => {
    const d = new Date(c.date);
    let key;
    if (period === 'weekly') {
      const day = d.getDay() || 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - day + 1);
      key = monday.toISOString().split('T')[0];
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    }
    if (!buckets.has(key)) {
      buckets.set(key, { date: key, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume });
    } else {
      const b = buckets.get(key);
      b.high = Math.max(b.high, c.high);
      b.low = Math.min(b.low, c.low);
      b.close = c.close;
      b.volume += c.volume;
    }
  });
  return [...buckets.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ── Indicators (all self-calculated, no dependency) ──────────────────────────
function calculateSMA(prices, period) {
  return prices.map((_, i) =>
    i < period - 1 ? null
      : prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
  );
}

function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  const ema = new Array(prices.length).fill(null);
  if (prices.length < period) return ema;
  ema[period - 1] = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema[i] = prices[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

function calculateRSI(prices, period = 14) {
  const rsi = new Array(prices.length).fill(null);
  if (prices.length < period + 1) return rsi;
  let ag = 0, al = 0;
  for (let i = 1; i <= period; i++) {
    const d = prices[i] - prices[i - 1];
    d >= 0 ? ag += d : al -= d;
  }
  ag /= period; al /= period;
  rsi[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = period + 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
    rsi[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return rsi;
}

function calculateMACD(prices, fast = 12, slow = 26, signal = 9) {
  const ef = calculateEMA(prices, fast);
  const es = calculateEMA(prices, slow);
  const macdLine = prices.map((_, i) => ef[i] !== null && es[i] !== null ? ef[i] - es[i] : null);
  const sigRaw = calculateEMA(macdLine.map(v => v ?? 0), signal);
  const sigLine = sigRaw.map((v, i) => macdLine[i] !== null ? v : null);
  const hist = macdLine.map((v, i) => v !== null && sigLine[i] !== null ? v - sigLine[i] : null);
  return { macd: macdLine, signal: sigLine, histogram: hist };
}

function calculateBollingerBands(prices, period = 20, sd = 2) {
  const mid = calculateSMA(prices, period);
  return prices.reduce((acc, _, i) => {
    if (mid[i] === null) {
      acc.upper.push(null); acc.middle.push(null); acc.lower.push(null);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      const sigma = Math.sqrt(slice.reduce((s, v) => s + (v - mid[i]) ** 2, 0) / period);
      acc.upper.push(mid[i] + sd * sigma);
      acc.middle.push(mid[i]);
      acc.lower.push(mid[i] - sd * sigma);
    }
    return acc;
  }, { upper: [], middle: [], lower: [] });
}

function calculateATR(candles, period = 14) {
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prev = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));
  });
  return calculateSMA(tr, period);
}

function calculateVWAP(candles) {
  let cv = 0, ctpv = 0;
  return candles.map(c => {
    const tp = (c.high + c.low + c.close) / 3;
    ctpv += tp * c.volume; cv += c.volume;
    return cv === 0 ? null : ctpv / cv;
  });
}

function detectVolumeSpike(volumes, period = 20, threshold = 2.0) {
  const avg = calculateSMA(volumes, period);
  return volumes.map((v, i) =>
    avg[i] !== null ? { isSpike: v > avg[i] * threshold, ratio: +(v / avg[i]).toFixed(2) } : null
  );
}

function detectEMACrossover(fast, slow) {
  return fast.map((f, i) => {
    if (i === 0 || f === null || slow[i] === null) return null;
    const pf = fast[i - 1], ps = slow[i - 1];
    if (pf === null || ps === null) return null;
    if (pf <= ps && f > slow[i]) return 'bullish';
    if (pf >= ps && f < slow[i]) return 'bearish';
    return null;
  });
}

function calculateStochRSI(prices, rsiPeriod = 14, stochPeriod = 14) {
  const rsi = calculateRSI(prices, rsiPeriod);
  return rsi.map((r, i) => {
    if (r === null || i < stochPeriod - 1) return null;
    const window = rsi.slice(i - stochPeriod + 1, i + 1).filter(v => v !== null);
    if (window.length < stochPeriod) return null;
    const lo = Math.min(...window), hi = Math.max(...window);
    return hi === lo ? 0 : +((r - lo) / (hi - lo) * 100).toFixed(2);
  });
}

// ── Note on 1-month window + indicators that need warm-up data ───────────────
// RSI needs 14+ candles, SMA200 needs 200. With only 30 days (~22 trading days)
// most longer-period indicators will return null for early candles — that is
// correct behaviour, not a bug. If you need SMA200 values, pass `days: 365`
// to getHistoricalData() (see below).

function processCandles(candles) {
  if (!candles.length) return [];
  const closes = candles.map(d => d.close);
  const volumes = candles.map(d => d.volume);

  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);
  const ema9 = calculateEMA(closes, 9);
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const ema50 = calculateEMA(closes, 50);
  const rsi14 = calculateRSI(closes, 14);
  const rsi9 = calculateRSI(closes, 9);
  const stochRsi = calculateStochRSI(closes);
  const macd = calculateMACD(closes, 12, 26, 9);
  const bb = calculateBollingerBands(closes, 20, 2);
  const atr14 = calculateATR(candles, 14);
  const vwap = calculateVWAP(candles);
  const volSpike = detectVolumeSpike(volumes, 20, 2.0);
  const emaCross = detectEMACrossover(ema12, ema26);

  return candles.map((c, i) => ({
    date: c.date,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    price_change_pct: i > 0 ? +((c.close - candles[i - 1].close) / candles[i - 1].close * 100).toFixed(4) : 0,
    high_low_range_pct: +(((c.high - c.low) / c.low) * 100).toFixed(4),
    indicators: {
      sma: {
        sma20: sma20[i],
        sma50: sma50[i],
        sma200: sma200[i],
        price_vs_sma20: sma20[i] ? +((c.close - sma20[i]) / sma20[i] * 100).toFixed(3) : null,
        price_vs_sma50: sma50[i] ? +((c.close - sma50[i]) / sma50[i] * 100).toFixed(3) : null,
        price_vs_sma200: sma200[i] ? +((c.close - sma200[i]) / sma200[i] * 100).toFixed(3) : null,
      },
      ema: {
        ema9: ema9[i], ema12: ema12[i], ema26: ema26[i], ema50: ema50[i],
        crossover_12_26: emaCross[i],
      },
      rsi: {
        rsi14: rsi14[i] !== null ? +rsi14[i].toFixed(2) : null,
        rsi9: rsi9[i] !== null ? +rsi9[i].toFixed(2) : null,
        stoch_rsi: stochRsi[i],
        oversold: rsi14[i] !== null && rsi14[i] < 30,
        overbought: rsi14[i] !== null && rsi14[i] > 70,
      },
      macd: {
        macd_line: macd.macd[i] !== null ? +macd.macd[i].toFixed(4) : null,
        signal_line: macd.signal[i] !== null ? +macd.signal[i].toFixed(4) : null,
        histogram: macd.histogram[i] !== null ? +macd.histogram[i].toFixed(4) : null,
        bullish_cross: macd.macd[i] !== null && macd.signal[i] !== null &&
          macd.macd[i] > macd.signal[i] &&
          i > 0 && macd.macd[i - 1] !== null && macd.macd[i - 1] <= macd.signal[i - 1],
      },
      bollinger: {
        upper: bb.upper[i] !== null ? +bb.upper[i].toFixed(3) : null,
        middle: bb.middle[i] !== null ? +bb.middle[i].toFixed(3) : null,
        lower: bb.lower[i] !== null ? +bb.lower[i].toFixed(3) : null,
        percent_b: (bb.upper[i] && bb.lower[i])
          ? +((c.close - bb.lower[i]) / (bb.upper[i] - bb.lower[i])).toFixed(3) : null,
        bandwidth: (bb.upper[i] && bb.lower[i])
          ? +((bb.upper[i] - bb.lower[i]) / bb.middle[i] * 100).toFixed(3) : null,
      },
      atr: { atr14: atr14[i] !== null ? +atr14[i].toFixed(4) : null },
      volume: {
        vwap: vwap[i] !== null ? +vwap[i].toFixed(3) : null,
        spike: volSpike[i],
        vol_vs_avg: volSpike[i] ? volSpike[i].ratio : null,
      },
    },
  }));
}

// ── Main exported function ───────────────────────────────────────────────────
// days: 30 = 1 month (default), 90 = 3 months, 365 = 1 year, 730 = 2 years
export async function getHistoricalData(symbol, days = 30) {
  const SYM = symbol.toUpperCase();
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `hist_${SYM}_${today}_${days}d`;

  const cached = getCached(cacheKey);
  if (cached) { console.log(`[cache hit] ${SYM}`); return cached; }

  try {
    // One request to FMP — filter to `days` window in the fetch
    const url = `${FMP_BASE}/historical-price-eod/full`;
    const { data } = await axios.get(url, {
      params: { symbol: SYM, apikey: FMP_KEY },
      timeout: 15000,
    });

    const raw = Array.isArray(data) ? data : (data?.historical ?? []);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const daily = raw
      .filter(d => new Date(d.date) >= cutoff)
      .map(d => ({
        date: d.date,
        open: parseFloat(d.open),
        high: parseFloat(d.high),
        low: parseFloat(d.low),
        close: parseFloat(d.close),
        volume: parseInt(d.volume ?? 0, 10),
      }))
      .filter(d => !isNaN(d.close) && d.close > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (!daily.length) throw new Error(`No candles in last ${days} days for ${SYM}`);

    const weekly = resampleCandles(daily, 'weekly');
    const monthly = resampleCandles(daily, 'monthly');

    const result = {
      symbol: SYM,
      generated_at: new Date().toISOString(),
      source: 'financialmodelingprep',
      window_days: days,
      intervals: {
        '1d': processCandles(daily),
        '1wk': processCandles(weekly),
        '1mo': processCandles(monthly),
      },
    };

    setCache(cacheKey, result);
    return result;

  } catch (err) {
    console.error(`getHistoricalData failed for ${SYM}:`, err.message);
    return null;
  }
}