// src/services/twelveDataService.js
import axios from "axios";
import * as cheerio from "cheerio";
import https from "https";

// Robust Yahoo Finance Initialization


import finnhub from "finnhub";
import { 
  calculateSMA, 
  calculateEMA, 
  calculateRSI, 
  calculateMACD, 
  calculateBollingerBands 
} from "../utils/indicators.js";

// list of symbols you want
const SYMBOLS = [
  "INTC", "MSFT", "CSCO", "KHC", "VRTX", "MNST", "CTAS", "ADSK", "GILD", "GOOGL",
  "ADBE", "QCOM", "WBD", "AMAT", "CDNS", "MCHP", "ISRG", "PAYX", "AAPL", "FAST",
  "PCAR", "AMZN", "ROST", "COST", "LRCX", "INTU", "CTSH", "KLAC", "AMGN", "EA",
  "BIIB", "NVDA", "SBUX", "AXON", "CMCSA", "MRVL", "ADI", "XEL", "CSX", "EXC",
  "MU", "MAR",  "HON", "AMD", "BKR", "PEP", "ADP", "KDP",
  "NFLX", "BKNG", "ORLY", "ROP",  "NXPI", "TSLA", "TTWO", "CHTR", "CSGP",
  "DXCM", "FTNT", "IDXX", "MELI", "MSTR", "ON", "TMUS", "META", "WDAY", "MDLZ",
  "LULU", "REGN", "AZN", "ASML", "CPRT",  "SNPS", "VRSK", "FANG", "PANW",
  "CDW", "GOOG", "SHOP", "PYPL", "TEAM", "ZS",  "DDOG",
  "PLTR", "ABNB", "DASH", "APP", "GFS",  "ARM", "LIN", "TRI"
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
     
     // Strategy C: Some summary data is in <div class="container"><div class="label">...</div><div class="value">...</div></div>
     // Often specifically for "Bid", "Ask", "Volume" in the summary header.
     // These might not be in 'li' or 'tr'.
     
     // Inspecting the 'Statistics' screenshot, it's definitely li > p.
     // But for "Bid"/"Ask", they are often in the "Quote Summary" area.
     // Check if standard table scan caught them. If not, we might need a specific look.
     // Let's add 'div' scan for specific class-less structures if needed, but let's stick to 'li' fix first as that is the main user complaint (Highlights).

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

     console.log(`Scraping took ${(Date.now() - start)}ms`);

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

async function scrapeTopStocks(url) {
  try {
     console.log(`Scraping top stocks from ${url}...`);
     
     const headers = { 
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/json,xml;q=0.9,*/*;q=0.8",
     };

     const { data } = await axios.get(url, { headers });
     const $ = cheerio.load(data);
     const stocks = [];

     // Yahoo Markets Table Selection
     // Select rows from the main table
     $('table tbody tr').each((i, row) => {
         if (stocks.length >= 10) return; // Limit to 10

         const cells = $(row).find('td');
         if (cells.length < 6) return; 

         const symbol = $(cells[0]).text().trim();
         const name = $(cells[1]).text().trim();
         
         // Index 2 is Sparkline, skip it
         const priceText = $(cells[3]).text().trim().replace(/,/g, '');
         const changeText = $(cells[4]).text().trim().replace(/,/g, '');
         const changePercentText = $(cells[5]).text().trim().replace(/[%()]/g, '');
         
         const volumeText = $(cells[6]).text().trim();
         const marketCapText = $(cells[8]).text().trim();
         const fiftyTwoWeekChangeText = $(cells[10]).text().trim().replace(/[%+,]/g, '');

         const price = parseFloat(priceText) || 0;
         const change = parseFloat(changeText) || 0;
         const changesPercentage = parseFloat(changePercentText) || 0;
         const volume = parseMultiplier(volumeText) || 0;
         const marketCap = parseMultiplier(marketCapText) || 0;
         const fiftyTwoWeekChangePercent = parseFloat(fiftyTwoWeekChangeText) || 0;
         
         // Only add valid stocks
         if (symbol && price) {
             stocks.push({
                 symbol,
                 name,
                 price,
                 change,
                 changesPercentage,
                 volume,
                 marketCap,
                 fiftyTwoWeekChangePercent
             });
         }
     });

     // Fetch sparklines in parallel for the found stocks
     const results = await Promise.all(stocks.map(async (stock) => {
       
        return {
            symbol: stock.symbol,
            name: stock.name,
            price: stock.price,
            change: stock.change,
            changesPercentage: stock.changesPercentage,
            volume: stock.volume,
            marketCap: stock.marketCap,
            fiftyTwoWeekChangePercent: stock.fiftyTwoWeekChangePercent,
        };
    }));

    return results;

  } catch (err) {
      console.error(`Error scraping ${url}:`, err.message);
      return [];
  }
}

export async function getTopGainers() {
  return await scrapeTopStocks("https://finance.yahoo.com/markets/stocks/gainers/");
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



export async function getTrendingStocks(filters = {}) {
  // 1. Try Cheerio Scraper First
  let data = await scrapeMostActiveStocks();

 

  // 3. Apply any filters if passed (placeholder for future logic)
  // Currently the controller passes body, but logic wasn't fully defined. 
  // We return whatever we found.
  
  return data;
}


/* ------------------------------------------------------
   6. HISTORICAL DATA WITH INDICATORS
------------------------------------------------------ */
// export async function getHistoricalData(symbol) {
//   try {
//     const endDate = new Date();
//     const startDate = new Date();
//     startDate.setMonth(endDate.getMonth() - 6); // 6 Months ago

//     const period1 = Math.floor(startDate.getTime() / 1000);
//     const period2 = Math.floor(endDate.getTime() / 1000);

//     // Fetch data for multiple intervals in parallel
//     // Yahoo intervals: 1d, 1wk, 1mo
//     const intervals = ["1d", "1wk", "1mo"];
    
//     // We can't use detailed options with simple chart queries in yahoo-finance2 easily without using historical
//     // yf.historical(symbol, queryOptions)
//     // queryOptions: { period1, period2, interval }

//     const results = {};

//     // Parallelize queries to be faster and reduce chance of single-timeout killing all
//     const promises = intervals.map(async (interval) => {
//         try {
//             const queryOptions = {
//                 period1: period1, 
//                 period2: period2,
//                 interval: interval 
//             };
            
//             // Use chart() 
//             const result = await yf.chart(symbol, queryOptions);
//             const data = result ? result.quotes : [];
            
//             if (!data || data.length === 0) {
//                 results[interval] = [];
//                 return;
//             }
            
//             // Extract close prices AND valid data together
//             const validData = data.filter(d => 
//                 d.close !== null && 
//                 d.close !== undefined &&
//                 d.date // Ensure date exists
//             );

//             // Sort by date ascending
//             validData.sort((a,b) => new Date(a.date) - new Date(b.date));

//             const closePrices = validData.map(d => d.close);

//             if (closePrices.length === 0) {
//                  results[interval] = [];
//                  return;
//             }

//             // Calculate Indicators
//             const sma20 = calculateSMA(closePrices, 20);
//             const sma50 = calculateSMA(closePrices, 50);
//             const sma200 = calculateSMA(closePrices, 200);
//             const ema12 = calculateEMA(closePrices, 12);
//             const ema26 = calculateEMA(closePrices, 26);
//             const rsi14 = calculateRSI(closePrices, 14);
//             const macd = calculateMACD(closePrices, 12, 26, 9);
//             const bb = calculateBollingerBands(closePrices, 20, 2);

//             // Merge back
//             const enrichedData = validData.map((candle, i) => ({
//                 date: candle.date.toISOString().split('T')[0],
//                 open: candle.open,
//                 high: candle.high,
//                 low: candle.low,
//                 close: candle.close,
//                 volume: candle.volume,
//                 indicators: {
//                     sma: {
//                         period20: sma20[i],
//                         period50: sma50[i],
//                         period200: sma200[i]
//                     },
//                     ema: {
//                         period12: ema12[i],
//                         period26: ema26[i]
//                     },
//                     rsi: {
//                         period14: rsi14[i]
//                     },
//                     macd: {
//                         macdLine: macd.macd[i],
//                         signalLine: macd.signal[i],
//                         histogram: macd.histogram[i]
//                     },
//                     bollinger: {
//                         upper: bb.upper[i],
//                         middle: bb.middle[i],
//                         lower: bb.lower[i]
//                     }
//                 }
//             }));

//             results[interval] = enrichedData;

//         } catch(err) {
//             console.error(`Error fetching historical for ${symbol} interval ${interval}:`, err.message);
//             results[interval] = [];
//         }
//     });

//     await Promise.all(promises);

//     return results;


//   } catch (err) {
//     console.error(`Error in getHistoricalData('${symbol}'):`, err.message);
//     return null;
//   }
// }

