// src/services/twelveDataService.js
import axios from "axios";
import finnhub from "finnhub";

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
    const quotes = await callFMP("/quote", { symbol });
    const quote = quotes && quotes.length > 0 ? quotes[0] : null;

    if (!quote) return null;

    // Optional: Fetch profile for description/logo
    let description = "";
    let logo = "";
    let sector = "";
    
    try {
        const profiles = await callFMP("/profile", { symbol });
        if (profiles && profiles.length > 0) {
            description = profiles[0].description;
            logo = profiles[0].image;
            sector = profiles[0].sector;
        }
    } catch(e) { /* ignore */ }


    return {
        symbol: quote.symbol,
        name: quote.name,
        exchange: quote.exchange,
        currency: "USD",
        datetime: new Date(quote.timestamp * 1000).toISOString(), 
        open: quote.open,
        high: quote.dayHigh,
        low: quote.dayLow,
        close: quote.price,
        volume: quote.volume,
        current_price: quote.price,
        change: quote.change,
        percent_change: quote.changePercentage ? quote.changePercentage.toFixed(2) : "0.00",
        market_cap: quote.marketCap,
        logo: logo, 
        description: description,
        sector: sector,
        price_avg_50: quote.priceAvg50,
        price_avg_200: quote.priceAvg200,
        year_high: quote.yearHigh,
        year_low: quote.yearLow
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
