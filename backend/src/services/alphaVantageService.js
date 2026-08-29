import axios from "axios";
import https from "https";
import { config } from "../config/env.js";

const BASE_URL = "https://www.alphavantage.co/query";

// Force IPv4 on Render (fixes empty response issue)
const agent = new https.Agent({ family: 4 });

// Alpha Vantage wrapper with all fixes
async function callAlpha(params) {
  try {
    const url = new URL(BASE_URL);
    Object.entries({
      ...params,
      apikey: config.alphaKey
    }).forEach(([k, v]) => url.searchParams.append(k, v));

    const response = await axios.get(url.toString(), {
      httpsAgent: agent,
      headers: {
        "User-Agent": "AcuTrader-Backend",
        "Accept": "application/json",
      },
      timeout: 6000,
    });

    const data = response.data;

    // If rate-limited or empty → log it
    if (data?.Note) {
      console.log("⚠ Alpha Vantage Throttle:", data.Note);
      return {};
    }

    return data || {};
  } catch (err) {
    console.error("❌ Alpha Vantage Error:", err.message);
    return {};
  }
}

//
// ----------------------------------------------
// SEARCH STOCK SYMBOL
// ----------------------------------------------
export async function searchSymbol(keyword) {
  if (!keyword) return [];

  const data = await callAlpha({
    function: "SYMBOL_SEARCH",
    keywords: encodeURIComponent(keyword)
  });

  return data?.bestMatches || [];
}

//
// ----------------------------------------------
// GET REAL-TIME QUOTE
// ----------------------------------------------
export async function getQuote(symbol) {
  if (!symbol) return {};

  const data = await callAlpha({
    function: "GLOBAL_QUOTE",
    symbol
  });

  return data["Global Quote"] || {};
}

//
// ----------------------------------------------
// WEEKLY MOST TRADED (TOP 10 VOLUME DAYS)
// ----------------------------------------------
export async function getWeeklyMostTraded(symbol) {
  if (!symbol) return [];

  const data = await callAlpha({
    function: "TIME_SERIES_DAILY",
    symbol,
    outputsize: "compact"
  });

  const series = data["Time Series (Daily)"] || {};
  const entries = Object.entries(series).map(([date, values]) => ({
    date,
    volume: Number(values["5. volume"] || 0),
  }));

  entries.sort((a, b) => b.volume - a.volume);
  return entries.slice(0, 10);
}
