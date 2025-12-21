// src/services/twelveDataService.js
import axios from "axios";
import yahooFinance from "yahoo-finance2";

const yf = new yahooFinance({ suppressNotices: ['yahooSurvey'] });
import finnhub from "finnhub";

// list of symbols you want
const SYMBOLS = [
   "INTC", "MSFT", "CSCO", "KHC", "VRTX", "MNST", "CTAS", "ADSK", "GILD", "GOOGL",
  "ADBE", "QCOM", "WBD", "AMAT", "CDNS", "MCHP", "ISRG", "PAYX", "AAPL", "FAST",
  "PCAR", "AMZN", "ROST", "COST", "LRCX", "AMGN", "EA",
  "BIIB", "NVDA",  "AXON", "CMCSA",  "ADI", "XEL", "CSX", "EXC",
  "MU",   "HON", "AMD", "BKR", "PEP", "ADP", "KDP",
  "NFLX", "BKNG", "ORLY",   "NXPI", "TSLA", "TTWO", "CHTR", "CSGP",
  "DXCM", "FTNT", "IDXX", "MELI", "MSTR", "ON", "TMUS", "META", "WDAY", "MDLZ",
  "LULU", "REGN", , "ASML", "CPRT",  "SNPS", "FANG", "PANW",
   "GOOG", "SHOP", "PYPL", "TEAM", "ZS",  "DDOG",
  "PLTR", "ABNB", "DASH", "APP",   "ARM", "LIN", "TRI"
];

// ---------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------

// FMP (Financial Modeling Prep) Config
const FMP_API_KEY = "7bwKOSRMhSLiJkbyPq6mAdFHWOUp5As0";
const FMP_BASE_URL = "https://financialmodelingprep.com/stable";

// Finnhub Config
// User requested simpler init: new finnhub.DefaultApi("API_KEY")
// We need to ensure finnhub.DefaultApi exists on the imported object.
// If typical CJS-in-ESM, it might be on finnhub.default or finnhub itself.
// We'll try to handle both or assume standard import behavior.
// If finnhub is the module.exports object:
let finnhubClient;
try {
   finnhubClient = new finnhub.DefaultApi("d518lt9r01qjia5c21p0d518lt9r01qjia5c21pg");
} catch (e) {
   // Fallback if 'finnhub' default export has DefaultApi under .default (common in some bundlers/node versions)
   if (finnhub.default && finnhub.default.DefaultApi) {
       finnhubClient = new finnhub.default.DefaultApi("d518lt9r01qjia5c21p0d518lt9r01qjia5c21pg");
   } else {
       console.error("Failed to initialize Finnhub client. Finnhub export:", finnhub);
       throw e;
   }
}

// ---------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------

// Helper for FMP requests
async function callFMP(endpoint, params = {}) {
  try {
    const url = `${FMP_BASE_URL}${endpoint}`;
    // Append API key to params
    const queryParams = { ...params, apikey: FMP_API_KEY };
    
    // Construct Query String
    const qs = Object.keys(queryParams)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');

    const requestUrl = `${url}?${qs}`;
    
    const res = await axios.get(requestUrl);
    return res.data;
  } catch (err) {
    console.error(`🔥 FMP API Error (${endpoint}):`, err.message);
    return null;
  }
}

// ---------------------------------------------------------
// EXPORTED SERVICES (STOCK ONLY)
// ---------------------------------------------------------

/* ------------------------------------------------------
   1. SYMBOL SEARCH (Stocks Only)
------------------------------------------------------ */
/* ------------------------------------------------------
   SYMBOL SEARCH (Stocks + Real-time Quote + Full Profile)
------------------------------------------------------ */
export async function searchSymbol(keyword) {
  try {
    // 1. Primary Lookup: SEC Profile (User requested replacement)
    // Treating 'keyword' as a potential symbol (e.g. "AAPL")
    const symbolParam = keyword.toUpperCase(); 
    const secProfiles = await callFMP("/sec-profile", { symbol: symbolParam });
    
    if (!secProfiles || !Array.isArray(secProfiles) || secProfiles.length === 0) {
      return {};
    }

    // Limit to top results
    const topResults = secProfiles.slice(0, 10);
    const symbols = topResults.map(r => r.symbol).join(",");

    // 2. Fetch Quotes (Price, Change, is_up)
    const quotes = await callFMP("/quote", { symbol: symbols });
    const quoteMap = {};
    if (Array.isArray(quotes)) {
      quotes.forEach(q => quoteMap[q.symbol] = q);
    }

    // 3. Fetch Full Profiles (Logo, Description, Web)
    const profiles = await callFMP("/profile", { symbol: symbols });
    const profileMap = {};
    if (Array.isArray(profiles)) {
      profiles.forEach(p => profileMap[p.symbol] = p);
    }

    const groupedResults = { Stocks: [] };

    // 4. Merge
    topResults.forEach(sec => {
      const sym = sec.symbol;
      const quote = quoteMap[sym] || {};
      const profile = profileMap[sym] || {};

      const price = quote.price || profile.price || 0;
      const change = quote.changes || profile.changes || 0;
      const changePercent = quote.changesPercentage || 
                           ((price && change) ? ((change / (price - change)) * 100) : 0);

      groupedResults.Stocks.push({
        symbol: sym,
        instrument_name: sec.companyName || profile.companyName || sym,
        exchange: sec.exchangeShortName || quote.exchange || "NASDAQ", 
        mic_code: sec.exchangeShortName || "XNAS", 
        country: sec.country || profile.country || "US",
        currency: profile.currency || quote.currency || "USD",
        type: "Stocks",

        // Real-time
        price: Number(price.toFixed(2)),
        change: Number(change.toFixed(2)),
        change_percent: Number(changePercent.toFixed(2)),
        is_up: change >= 0,

        // Details
        market_cap: quote.marketCap || profile.mktCap,
        volume: quote.volume || profile.volAvg,
        avg_volume: quote.avgVolume || profile.volAvg,
        range: quote.dayLow && quote.dayHigh ? `${quote.dayLow}-${quote.dayHigh}` : null,
        year_range: quote.yearLow && quote.yearHigh ? `${quote.yearLow}-${quote.yearHigh}` : null,
        
        sector: sec.sector || profile.sector,
        industry: sec.industry || profile.industry,
        description: profile.description || "No description available.",
        ceo: sec.ceo || profile.ceo,
        website: profile.website,
        employees: sec.fullTimeEmployees || profile.fullTimeEmployees,

        // Logo
        image: profile.image || `https://financialmodelingprep.com/image-stock/${sym}.png`
      });
    });

    return groupedResults;

  } catch (err) {
    console.error(`Error in searchSymbol('${keyword}'):`, err.message);
    return {};
  }
}


/* ------------------------------------------------------
   2. REALTIME QUOTE 
------------------------------------------------------ */

export async function getQuote(symbol) {
  try {
    // 1. Fetch Price & Basic Data
    const quote = await yf.quote(symbol);
    if (!quote) return null;

    // 2. Fetch Profile Data (Description, Sector)
    let description = "";
    let sector = "";
    try {
        const summary = await yf.quoteSummary(symbol, { modules: ["assetProfile"] });
        if (summary && summary.assetProfile) {
            description = summary.assetProfile.longBusinessSummary || "";
            sector = summary.assetProfile.sector || "";
        }
    } catch (e) {
        console.warn(`getQuote: Failed to fetch profile for ${symbol}:`, e.message);
    }

    // 3. Construct Logo URL (Yahoo doesn't provide it, use previous source or placeholder)
    const logo = `https://financialmodelingprep.com/image-stock/${symbol}.png`;

    return {
        symbol: quote.symbol,
        name: quote.longName || quote.shortName || quote.displayName || quote.symbol,
        exchange: quote.fullExchangeName || quote.exchange || "US",
        currency: quote.currency || "USD",
        // Yahoo returns Date object for regularMarketTime
        datetime: quote.regularMarketTime ? new Date(quote.regularMarketTime).toISOString() : new Date().toISOString(),
        open: quote.regularMarketOpen || 0,
        high: quote.regularMarketDayHigh || 0,
        low: quote.regularMarketDayLow || 0,
        close: quote.regularMarketPrice || 0,
        volume: quote.regularMarketVolume || 0,
        current_price: quote.regularMarketPrice || 0,
        change: quote.regularMarketChange || 0,
        percent_change: quote.regularMarketChangePercent ? quote.regularMarketChangePercent.toFixed(2) : "0.00",
        market_cap: quote.marketCap || 0,
        logo: logo,
        description: description,
        sector: sector,
        price_avg_50: quote.fiftyDayAverage || 0,
        price_avg_200: quote.twoHundredDayAverage || 0,
        year_high: quote.fiftyTwoWeekHigh || 0,
        year_low: quote.fiftyTwoWeekLow || 0
    };
  } catch (err) {
    console.error(`Error in getQuote('${symbol}'):`, err.message);
    return null;
  }
}

/* ------------------------------------------------------
   3. STOCK PRICE CHANGE
------------------------------------------------------ */
export async function getStockPriceChange(symbol) {
    try {
        const changes = await callFMP("/stock-price-change", { symbol });
        if (changes && changes.length > 0) {
            return changes[0];
        }
        return null;
    } catch(err) {
        console.error(`Error in getStockPriceChange('${symbol}'):`, err.message);
        return null;
    }
}

/* ------------------------------------------------------
   4. STOCK RECOMMENDATIONS (Finnhub)
------------------------------------------------------ */
export function getStockRecommendations(symbol) {
    return new Promise((resolve, reject) => {
        if (!finnhubClient) {
            console.error("Finnhub client not initialized.");
            resolve([]);
            return;
        }
        finnhubClient.recommendationTrends(symbol, (error, data, response) => {
            if (error) {
                console.error(`Error in getStockRecommendations('${symbol}'):`, error);
                resolve([]); // Resolve empty array on error to prevent crash
            } else {
                resolve(data);
            }
        });
    });
}

/* ------------------------------------------------------
   5. TOP TRENDING STOCKS (Dynamic Screener)
-
----------------------------------------------------- */

export async function getTrendingStocks() {
  try {
    // ⏱ safety timeout helper
    const timeout = (ms) =>
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Yahoo timeout")), ms)
      );

    // Fetch per symbol with individual timeout to ensure we get partial results if some hang
    // Using `yf` instance instead of default export from user snippet
    const quotePromises = SYMBOLS.map(symbol =>
      Promise.race([
        yf.quote(symbol),
        timeout(12000) // 12s per symbol max
      ])
      .then(quote => quote)
      .catch(err => {
        // Log locally but return null so Promise.all doesn't fail globally
        console.warn(`Quote failed for ${symbol}:`, err.message);
        return null;
      })
    );

    const quotes = await Promise.all(quotePromises);

    const results = quotes
      .filter(Boolean)
      .map(q => ({
        ...q,
        symbol: q.symbol,
        name: q.longName || q.shortName || q.displayName || q.symbol,
        current_price: q.regularMarketPrice ?? 0,
        change: q.regularMarketChange ?? 0,
        percent_change: q.regularMarketChangePercent ?? 0,
        volume: q.regularMarketVolume ?? 0,
        market_cap: q.marketCap ?? 0,
        exchange: q.fullExchangeName || q.exchange || "US",
        // Valid for Date object (no *1000 multiplier needed as verified)
        datetime: q.regularMarketTime
          ? new Date(q.regularMarketTime).toISOString()
          : new Date().toISOString(),
        is_up: (q.regularMarketChange ?? 0) >= 0
      }));

    return results;

  } catch (err) {
    console.error("getTrendingStocks fatal error:", err);
    return [];
  }
}

