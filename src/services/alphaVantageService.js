import fetch from "node-fetch";
import { config } from "../config/env.js";

const BASE_URL = "https://www.alphavantage.co/query";

async function callAlpha(params) {
  const url = new URL(BASE_URL);
  Object.entries({
    ...params,
    apikey: config.alphaKey
  }).forEach(([k, v]) => url.searchParams.append(k, v));

  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Alpha Vantage error");
  return resp.json();
}

// SEARCH SYMBOL
export async function searchSymbol(keyword) {
  const data = await callAlpha({
    function: "SYMBOL_SEARCH",
    keywords: keyword
  });
  return data?.bestMatches || [];
}

// INTRADAY / PRICE
export async function getQuote(symbol) {
  const data = await callAlpha({
    function: "GLOBAL_QUOTE",
    symbol
  });
  return data["Global Quote"] || {};
}

// WEEKLY MOST TRADED (by volume)
export async function getWeeklyMostTraded(symbol, slice = "week") {
  // Use TIME_SERIES_DAILY or WEEKLY and aggregate by week.
  const data = await callAlpha({
    function: "TIME_SERIES_DAILY",
    symbol,
    outputsize: "compact"
  });

  // Simplify: return highest volume in last 7/30 days
  const series = data["Time Series (Daily)"] || {};
  const entries = Object.entries(series).map(([date, info]) => ({
    date,
    volume: Number(info["5. volume"] || 0)
  }));

  entries.sort((a, b) => b.volume - a.volume);
  return entries.slice(0, 10); // top 10 days by volume
}
