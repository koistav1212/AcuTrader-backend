// src/services/twelveDataService.js
import axios from "axios";
import https from "https";
import { config } from "../config/env.js";

const BASE_URL = "https://api.twelvedata.com";
const agent = new https.Agent({ family: 4 });

/* ------------------------------------------------------
   GLOBAL CACHE (1 minute)
------------------------------------------------------ */
const CACHE = {};
const TTL = 60 * 1000;

function setCache(key, data) {
  CACHE[key] = { data, expiry: Date.now() + TTL };
}
function getCache(key) {
  const c = CACHE[key];
  return c && Date.now() < c.expiry ? c.data : null;
}

/* ------------------------------------------------------
   Helper - Build URL
------------------------------------------------------ */
function buildURL(endpoint, query = {}) {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v != null) url.searchParams.append(k, v);
  });
  url.searchParams.append("apikey", config.twelveKey);
  return url.toString();
}

/* ------------------------------------------------------
   Core Caller
------------------------------------------------------ */
async function call(endpoint, query = {}, cacheKey) {
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const url = buildURL(endpoint, query);
    const res = await axios.get(url, {
      httpsAgent: agent,
      timeout: 6000,
    });

    if (res.data?.status === "error") {
      console.error(`❌ TwelveData Error:`, res.data.message);
      return null;
    }

    setCache(cacheKey, res.data);
    return res.data;

  } catch (err) {
    console.error(`🔥 API Error (${endpoint}):`, err.message);
    return null;
  }
}

/* ------------------------------------------------------
   1. SYMBOL SEARCH — returns documented TwelveData format
------------------------------------------------------ */
export async function searchSymbol(keyword) {
  return await call(
    "symbol_search",
    { symbol: keyword.trim() },
    `search_${keyword}`
  );
}

/* ------------------------------------------------------
   2. REALTIME QUOTE — exact quote format
------------------------------------------------------ */
export async function getQuote(symbol) {
  return await call(
    "quote",
    { symbol },
    `quote_${symbol}`
  );
}

/* ------------------------------------------------------
   3. WEEKLY MOST TRADED — time_series 1day
------------------------------------------------------ */


/**************************************
 * 1) Get Trending Symbols (Yahoo)
 **************************************/
async function getTrendingSymbols() {
  try {
    const url = "https://query1.finance.yahoo.com/v1/finance/trending/US";
    const res = await axios.get(url);

    const quotes = res.data.finance.result[0].quotes;

    return quotes.slice(0, 20).map(q => q.symbol); // top 7 trending
  } catch (err) {
    console.error("Yahoo Trending Error:", err.message);
    return [];
  }
}

/**************************************
 * 2) Get Company Name (Yahoo)
 **************************************/
async function getCompanyName(symbol) {
  try {
    // Try normal Yahoo quote API (stocks, ETFs)
    const url1 = `https://query1.finance.yahoo.com/v1/finance/quote?symbols=${symbol}`;
    const res1 = await axios.get(url1);

    const data1 = res1.data?.quoteResponse?.result?.[0];

    if (data1) {
      return (
        data1.longName ||
        data1.shortName ||
        data1.displayName ||
        symbol
      );
    }
  } catch (err) {
    // ignore and try crypto fallback
  }

  try {
    // CRYPTO fallback (special Yahoo endpoint)
    const url2 = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price`;
    const res2 = await axios.get(url2);

    const price = res2.data?.quoteSummary?.result?.[0]?.price;

    if (price) {
      return (
        price.longName ||
        price.shortName ||
        price.fromCurrency ||
        symbol
      );
    }
  } catch (err) {
    // ignore final fallback
  }

  // FINAL fallback (never returns undefined)
  return symbol;
}

/**************************************
 * 3) Get 7-Day OHLCV (Yahoo)
 **************************************/
async function getHistorical(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=7d`;

    const res = await axios.get(url);
    const chart = res.data.chart.result[0];

    return {
      symbol,
      closes: chart.indicators.quote[0].close,
      volumes: chart.indicators.quote[0].volume,
      timestamps: chart.timestamp,
    };

  } catch (err) {
    console.error(`Historical Error (${symbol}):`, err.message);
    return null;
  }
}

/**************************************
 * 4) FINAL: Weekly Most Traded
 **************************************/
export async function getWeeklyMostTraded() {
  const symbols = await getTrendingSymbols();
  if (symbols.length === 0) return [];

  const results = [];

  for (const s of symbols) {
    const h = await getHistorical(s);
    if (!h) continue;

    const closes = h.closes || [];
    const volumes = h.volumes || [];

    if (closes.length < 2) continue;

    const last = closes[closes.length - 1];
    const prev = closes[0];

    // get proper company name
    const name = await getCompanyName(s);

    const weeklyVolume = volumes.reduce((a, b) => a + (b || 0), 0);

    results.push({
      symbol: s,
      name, // FIXED NAME
      weekly_volume: weeklyVolume,
      last_price: Number(last),
      percent_change: (((last - prev) / prev) * 100).toFixed(2),
      color: last >= prev ? "green" : "red",
      sparkline: closes.map(c => Number(c)),
    });
  }

  return results.sort((a, b) => b.weekly_volume - a.weekly_volume);
}

/* ------------------------------------------------------
   5. INTRADAY (FULL CANDLE DATA)
------------------------------------------------------ */
export async function getIntraday(symbol, interval = "1min") {
  return await call(
    "time_series",
    {
      symbol,
      interval,
      outputsize: 100,
    },
    `intraday_${symbol}_${interval}`
  );
}

/* ------------------------------------------------------
   6. ETF LIST — exact ETF data
------------------------------------------------------ */
export async function getETFList() {
  return await call("etf", {}, "etf_list");
}

/* ------------------------------------------------------
   7. ETF WORLD — fully documented format
------------------------------------------------------ */
export async function getETFDetails(symbol) {
  return await call(
    "etfs/world",
    { symbol },
    `etf_world_${symbol}`
  );
}

/* ------------------------------------------------------
   8. MUTUAL FUNDS — documented format
------------------------------------------------------ */
/* ------------------------------------------------------
   MUTUAL FUND DETAILS (working free tier endpoint)
------------------------------------------------------ */
export async function getMutualFund(symbol) {
  return await call(
    "mutual_funds",
    { symbol },
    `mf_${symbol}`
  );
}

/* ------------------------------------------------------
   CRYPTO LIST (top crypto assets)
------------------------------------------------------ */
/* ------------------------------------------------------
   CRYPTO LIST WITH PRICE, CHANGE %, VOLUME, SPARKLINE
------------------------------------------------------ */
export async function getCryptoList() {
  // 1) Fetch crypto list – 1 token
  const list = await call("cryptocurrencies", {}, "crypto_list_cheap");
  const items = list?.data?.slice(0, 5) || []; // ONLY TOP 5

  if (items.length === 0) return [];

  // Extract symbols (BTC/USD)
  const symbols = items.map(c => c.symbol).join(",");

  // 2) Bulk quote for all 5 cryptos – 1 token
  const quotes = await call(
    "quote",
    { symbol: symbols },
    "crypto_quotes_cheap"
  );

  // Output formatted similar to stocks
  return Object.values(quotes || {}).map(q => ({
    symbol: q.symbol,
    name: q.name || q.currency_base,
    price: Number(q.close || 0),
    change_percent: Number(q.percent_change || 0),
    volume: Number(q.volume || 0),
    color: Number(q.percent_change || 0) >= 0 ? "green" : "red"
  }));
}



/* ------------------------------------------------------
   CRYPTO DETAILS (price, metadata, OHLC)
------------------------------------------------------ */
export async function getCryptoDetails(symbol) {
  const [quote, series] = await Promise.all([
    call("price", { symbol }, `crypto_price_${symbol}`),
    call(
      "time_series",
      { symbol, interval: "1h", outputsize: 50 },
      `crypto_series_${symbol}`
    )
  ]);

  return {
    symbol,
    price: Number(quote?.price || 0),
    candles: (series?.values || []).map(v => ({
      datetime: v.datetime,
      open: Number(v.open),
      high: Number(v.high),
      low: Number(v.low),
      close: Number(v.close),
      volume: Number(v.volume || 0)
    }))
  };
}

