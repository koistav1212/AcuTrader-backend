import axios from "axios";
import https from "https";
import { config } from "../config/env.js";

const BASE_URL = "https://api.twelvedata.com";

// Force IPv4 for Render & Railway
const agent = new https.Agent({ family: 4 });

// Core HTTP call wrapper
async function callTwelveData(params) {
  try {
    const url = new URL(BASE_URL + "/" + params.endpoint);

    Object.entries(params.query).forEach(([k, v]) =>
      url.searchParams.append(k, v)
    );

    url.searchParams.append("apikey", config.twelveKey);

    const response = await axios.get(url.toString(), {
      httpsAgent: agent,
      timeout: 6000,
      headers: {
        "User-Agent": "AcuTrader-Backend",
        Accept: "application/json"
      }
    });

    const data = response.data;

    // TwelveData error format
    if (data?.code || data?.status === "error") {
      console.error("TwelveData error:", data.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error("TwelveData Fetch Error:", err.message);
    return null;
  }
}

//
// ---------------------------------------------------
// SEARCH SYMBOL
// ---------------------------------------------------
export async function searchSymbol(keyword) {
  const data = await callTwelveData({
    endpoint: "symbol_search",
    query: {
      symbol: keyword.trim()
    }
  });

  return data?.data || [];
}

//
// ---------------------------------------------------
// REAL-TIME QUOTE
// ---------------------------------------------------
export async function getQuote(symbol) {
  const data = await callTwelveData({
    endpoint: "quote",
    query: {
      symbol
    }
  });

  return data || {};
}

//
// ---------------------------------------------------
// WEEKLY MOST TRADED (Top 10 Volumes)
// ---------------------------------------------------
export async function getWeeklyMostTraded(symbol) {
  const data = await callTwelveData({
    endpoint: "time_series",
    query: {
      symbol,
      interval: "1day",
      outputsize: "30" // last 30 days
    }
  });

  const series = data?.values || [];

  const sorted = series
    .map(v => ({
      date: v.datetime,
      volume: Number(v.volume || 0)
    }))
    .sort((a, b) => b.volume - a.volume);

  return sorted.slice(0, 10);
}
