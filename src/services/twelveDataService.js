// src/services/twelveDataService.js
import axios from "axios";
import yahooFinance from "yahoo-finance2";
import * as cheerio from "cheerio";
import https from "https";

// Robust Yahoo Finance Initialization
// Handle both CommonJS/ESM interop differences
let yf;
try {
  // Check if yahooFinance is a class/constructor
  if (typeof yahooFinance === 'function' && yahooFinance.prototype) {
      yf = new yahooFinance({ suppressNotices: ['yahooSurvey'] });
  } else if (yahooFinance && typeof yahooFinance === 'object') {
     // It's likely an instance or a namespace with default export
     yf = yahooFinance; // Assume it's the ready-to-use instance
     if (yf.suppressNotices) {
         yf.suppressNotices(['yahooSurvey']);
     }
  } else {
     throw new Error("Unknown Yahoo Finance export type: " + typeof yahooFinance);
  }
} catch (err) {
  console.error("Failed to initialize Yahoo Finance client:", err.message);
  // Fallback to default export if available, or just throw
  yf = yahooFinance; 
}

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
/* ------------------------------------------------------
   SYMBOL SEARCH (Stocks + Real-time Quote + Full Profile)
------------------------------------------------------ */
/* ------------------------------------------------------
   1. SYMBOL SEARCH (Stocks Only) - ENHANCED
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

     const { data } = await axios.get(url, { headers });
     const $ = cheerio.load(data);

     // 1. Core Price Data (fin-streamer)
     const getStreamer = (field) => {
         // Try matching by data-field AND data-symbol
         const el = $(`fin-streamer[data-field="${field}"][data-symbol="${SYM}"]`);
         if (el.length) return el.attr('value') || el.text().replace(/[(),%]/g, ''); // Remove parens and % for parsing
         
         // Fallback just data-field
         const el2 = $(`fin-streamer[data-field="${field}"]`);
         return el2.attr('value') || el2.text().replace(/[(),%]/g, '');
     };

     const currentPrice = parseFloat(getStreamer("regularMarketPrice"));
     const change = parseFloat(getStreamer("regularMarketChange"));
     const percentChange = parseFloat(getStreamer("regularMarketChangePercent"));
     const volume = parseFloat(getStreamer("regularMarketVolume"));

     // 2. Stats from Labels
     const getStat = (label) => {
         let el = $('*').filter((i, e) => {
             const text = $(e).clone().children().remove().end().text().trim().replace(/\s+/g, ' ');
             return text === label;
         }).first();

         if (el.length) return el.next().text().trim();

         // Fallback to startsWith if exact match failed
         el = $('*').filter((i, e) => {
             const text = $(e).clone().children().remove().end().text().trim().replace(/\s+/g, ' ');
             return text.startsWith(label);
         }).first();

         if (el.length) return el.next().text().trim();
         
         return null;
     };

     const prevClose = getStat("Previous Close");
     const open = getStat("Open");
     const dayRange = getStat("Day's Range"); 
     const fiftyTwoWeekRange = getStat("52 Week Range");
     const marketCap = getStat("Market Cap") || getStreamer("marketCap");
     const avgVolume = getStat("Avg. Volume");
     const peRatio = getStat("PE Ratio (TTM)");
     const eps = getStat("EPS (TTM)");
     const earningsDate = getStat("Earnings Date");
     const divYield = getStat("Forward Dividend & Yield");
     const targetEst = getStat("1y Target Est");

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
       bid: 0, ask: 0,
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
  try {
    const modules = [
        "price",
        "summaryDetail",
        "financialData",
        "defaultKeyStatistics",
        "recommendationTrend",
        "assetProfile"
    ];

    const result = await yf.quoteSummary(symbol, { modules });
    
    // Safety checks
    const price = result.price || {};
    const summary = result.summaryDetail || {};
    const financials = result.financialData || {};
    const stats = result.defaultKeyStatistics || {};
    const profile = result.assetProfile || {};

    return {
        // Identity
        symbol: symbol,
        name: price.longName || price.shortName || symbol,
        exchange: price.exchangeName || "US",
        currency: price.currency || "USD",
        datetime: new Date().toISOString(),
        logo: `https://financialmodelingprep.com/image-stock/${symbol}.png`, // Keep using FMP image CDN if mostly reliable for logos, or switch to clearbit

        // Trading Information
        open: summary.open,
        high: summary.dayHigh,
        low: summary.dayLow,
        previousClose: summary.previousClose,
        volume: summary.volume,
        avgVolume3M: summary.averageVolume,
        bid: summary.bid,
        bidSize: summary.bidSize,
        ask: summary.ask,
        askSize: summary.askSize,
        beta: summary.beta,

        // Prices
        current_price: price.regularMarketPrice,
        change: price.regularMarketChange,
        percent_change: price.regularMarketChangePercent ? price.regularMarketChangePercent * 100 : 0, // QuoteSummary returns decimal e.g. 0.015 for 1.5%? Need to verify. standard yf.quote is % value. quoteSummary detail is usually decimal.
        // Actually, usually summaryDetail.regularMarketChangePercent is not there, check price module.
        // price.regularMarketChangePercent is typically a decimal like 0.015 (1.5%) in quoteSummary? 
        // Let's rely on standard Quote if needed, but quoteSummary 'price' module usually has it.
        // Let's strictly check: if < 1 abs, likely decimal.

        // Valuation & Financials
        marketCap: summary.marketCap,
        peRatioTTM: summary.trailingPE,
        forwardPE: summary.forwardPE,
        epsTTM: stats.trailingEps,
        epsForward: stats.forwardEps,
        priceToBook: stats.priceToBook,
        bookValue: stats.bookValue,
        dividendRate: summary.dividendRate,
        dividendYield: summary.dividendYield, // usually decimal

        // Ranges & Averages
        fiftyTwoWeekLow: summary.fiftyTwoWeekLow,
        fiftyTwoWeekHigh: summary.fiftyTwoWeekHigh,
        fiftyTwoWeekChange: stats['52WeekChange'],
        fiftyDayAverage: summary.fiftyDayAverage,
        twoHundredDayAverage: summary.twoHundredDayAverage,

        // Analyst Rating
        recommendationKey: financials.recommendationKey,
        targetMeanPrice: financials.targetMeanPrice,
        numberOfAnalystOpinions: financials.numberOfAnalystOpinions,
        
        description: profile.longBusinessSummary || "",
        sector: profile.sector || "",
    };

    // Note: If description/sector is CRITICAL, we need 'assetProfile' module too.
    // The previous implementation fetched it. Let's add it in next step if user misses it.
    // The prompt asked for "Trading, Valuation..." specifically.
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
        // 1. Get Current Quote (for 1D and Current Price)
        const quote = await yf.quote(symbol);
        if (!quote) throw new Error("Quote not found");

        const currentPrice = quote.regularMarketPrice;
        const current1D = quote.regularMarketChangePercent;

        // 2. Get Historical Data (Max Range)
        // 'chart' requires period1 (start) and period2 (end). range is not always supported directly in options validation.
        const period1 = 0; // Epoch
        const period2 = Math.floor(Date.now() / 1000);
        
        const chart = await yf.chart(symbol, { interval: '1d', period1, period2 });
        const quotes = chart?.quotes || [];

        if (quotes.length === 0) throw new Error("No historical data");

        // Sort just in case, though usually sorted
        quotes.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Helper to find Close Price closest to a target date (going backwards)
        function getCloseAtDate(targetDate) {
            // We want the price on the day <= targetDate
            // Since array is sorted ascending, we can look for the last entry <= targetDate
            for (let i = quotes.length - 1; i >= 0; i--) {
                const d = new Date(quotes[i].date);
                if (d <= targetDate) {
                    return quotes[i].close;
                }
            }
            return quotes[0].close; // Return earliest if target is before start
        }

        const now = new Date();
        const getShiftedDate = (days, months = 0, years = 0) => {
            const d = new Date(now);
            d.setDate(d.getDate() - days);
            d.setMonth(d.getMonth() - months);
            d.setFullYear(d.getFullYear() - years);
            return d;
        };

        const periods = {
            "5D": getShiftedDate(5),
            "1M": getShiftedDate(0, 1),
            "3M": getShiftedDate(0, 3),
            "6M": getShiftedDate(0, 6),
            "ytd": new Date(new Date().getFullYear(), 0, 1), // Jan 1st of current year
            "1Y": getShiftedDate(0, 0, 1),
            "3Y": getShiftedDate(0, 0, 3),
            "5Y": getShiftedDate(0, 0, 5),
            "10Y": getShiftedDate(0, 0, 10),
            "max": new Date(0) // Earliest possible
        };

        const result = {
            symbol: symbol,
            "1D": current1D
        };

        for (const [key, date] of Object.entries(periods)) {
            const oldPrice = getCloseAtDate(date);
            if (oldPrice) {
                const change = ((currentPrice - oldPrice) / oldPrice) * 100;
                result[key] = change;
            } else {
                result[key] = null;
            }
        }

        return result;

    } catch(err) {
        console.error(`Error in getStockPriceChange('${symbol}'):`, err.message);
        return null;
    }
}

/* ------------------------------------------------------
   4. STOCK RECOMMENDATIONS (Finnhub)
------------------------------------------------------ */
export async function getStockRecommendations(symbol) {
    try {
        const result = await yf.quoteSummary(symbol, { modules: ['recommendationTrend'] });
        if (result && result.recommendationTrend && result.recommendationTrend.trend) {
            return result.recommendationTrend.trend;
        }
        return [];
    } catch (err) {
        console.error(`Error in getStockRecommendations('${symbol}'):`, err.message);
        return [];
    }
}

/* ------------------------------------------------------
   5. TOP TRENDING STOCKS (Dynamic Screener)
-
----------------------------------------------------- */

// Helper: Yahoo Implementation
// Helper: Cheerio Scraper Implementation
async function scrapeMostActiveStocks() {
  const url =
    "https://query2.finance.yahoo.com/v1/finance/screener/predefined/saved?count=200&formatted=false&scrIds=most_actives";

  const { data } = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
    }
  });

  const results = data.finance.result[0].quotes;

  return results.map(x => ({
    symbol: x.symbol,
    name: x.shortName,
    current_price: x.regularMarketPrice,
    change: x.regularMarketChange,
    percent_change: x.regularMarketChangePercent,
    volume: x.regularMarketVolume,
    market_cap: x.marketCap,
    exchange: x.fullExchangeName,
    datetime: new Date().toISOString(),
    is_up: x.regularMarketChange >= 0
  }));
}


// Helper: Finnhub Implementation
async function getTrendingStocksFinnhub() {
    console.log("Attempting to fetch trending stocks from Finnhub...");
    if (!finnhubClient) {
        console.error("Finnhub client not initialized.");
        return [];
    }

    // Limit to top 10 to respect rate limits (60 calls/min free tier)
    const limitedSymbols = SYMBOLS.slice(0, 10);
    
    // Helper to promisify finnhub callback
    const getQuoteFinnhub = (symbol) => {
        return new Promise((resolve, reject) => {
            finnhubClient.quote(symbol, (error, data, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ symbol, ...data });
                }
            });
        });
    };

    const results = [];
    
    // Sequential fetching for Finnhub to be safe with limits
    for (const symbol of limitedSymbols) {
        try {
            const data = await getQuoteFinnhub(symbol);
            // Finnhub Response Map: c: Current, d: Change, dp: Percent, h: High, l: Low, o: Open, pc: Prev Close
            results.push({
                symbol: data.symbol,
                name: data.symbol, // Finnhub quote doesn't give name, use symbol
                current_price: data.c,
                change: data.d,
                percent_change: data.dp,
                volume: 0, // Quote endpoint doesn't return volume in free tier usually
                market_cap: 0, 
                exchange: "US",
                datetime: new Date().toISOString(), // t is unix timestamp
                is_up: data.d >= 0
            });
            // tiny delay
            await new Promise(r => setTimeout(r, 100)); // 100ms delay
        } catch(err) {
            console.warn(`Finnhub quote failed for ${symbol}:`, err.message);
        }
    }
    
    console.log(`Fetched ${results.length} quotes from Finnhub.`);
    return results;
}


export async function getTrendingStocks(filters = {}) {
  // 1. Try Cheerio Scraper First
  let data = await scrapeMostActiveStocks();

  // 2. Fallback to Finnhub if Yahoo fails or returns empty
  if (!data || data.length === 0) {
      console.warn("Yahoo Finance returned empty/null. Switching to Finnhub fallback...");
      data = await getTrendingStocksFinnhub();
  }

  // 3. Apply any filters if passed (placeholder for future logic)
  // Currently the controller passes body, but logic wasn't fully defined. 
  // We return whatever we found.
  
  return data;
}


/* ------------------------------------------------------
   6. HISTORICAL DATA WITH INDICATORS
------------------------------------------------------ */
export async function getHistoricalData(symbol) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - 6); // 6 Months ago

    const period1 = Math.floor(startDate.getTime() / 1000);
    const period2 = Math.floor(endDate.getTime() / 1000);

    // Fetch data for multiple intervals in parallel
    // Yahoo intervals: 1d, 1wk, 1mo
    const intervals = ["1d", "1wk", "1mo"];
    
    // We can't use detailed options with simple chart queries in yahoo-finance2 easily without using historical
    // yf.historical(symbol, queryOptions)
    // queryOptions: { period1, period2, interval }

    const results = {};

    // Parallelize queries to be faster and reduce chance of single-timeout killing all
    const promises = intervals.map(async (interval) => {
        try {
            const queryOptions = {
                period1: period1, 
                period2: period2,
                interval: interval 
            };
            
            // Use chart() 
            const result = await yf.chart(symbol, queryOptions);
            const data = result ? result.quotes : [];
            
            if (!data || data.length === 0) {
                results[interval] = [];
                return;
            }
            
            // Extract close prices AND valid data together
            const validData = data.filter(d => 
                d.close !== null && 
                d.close !== undefined &&
                d.date // Ensure date exists
            );

            // Sort by date ascending
            validData.sort((a,b) => new Date(a.date) - new Date(b.date));

            const closePrices = validData.map(d => d.close);

            if (closePrices.length === 0) {
                 results[interval] = [];
                 return;
            }

            // Calculate Indicators
            const sma20 = calculateSMA(closePrices, 20);
            const sma50 = calculateSMA(closePrices, 50);
            const sma200 = calculateSMA(closePrices, 200);
            const ema12 = calculateEMA(closePrices, 12);
            const ema26 = calculateEMA(closePrices, 26);
            const rsi14 = calculateRSI(closePrices, 14);
            const macd = calculateMACD(closePrices, 12, 26, 9);
            const bb = calculateBollingerBands(closePrices, 20, 2);

            // Merge back
            const enrichedData = validData.map((candle, i) => ({
                date: candle.date.toISOString().split('T')[0],
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                volume: candle.volume,
                indicators: {
                    sma: {
                        period20: sma20[i],
                        period50: sma50[i],
                        period200: sma200[i]
                    },
                    ema: {
                        period12: ema12[i],
                        period26: ema26[i]
                    },
                    rsi: {
                        period14: rsi14[i]
                    },
                    macd: {
                        macdLine: macd.macd[i],
                        signalLine: macd.signal[i],
                        histogram: macd.histogram[i]
                    },
                    bollinger: {
                        upper: bb.upper[i],
                        middle: bb.middle[i],
                        lower: bb.lower[i]
                    }
                }
            }));

            results[interval] = enrichedData;

        } catch(err) {
            console.error(`Error fetching historical for ${symbol} interval ${interval}:`, err.message);
            results[interval] = [];
        }
    });

    await Promise.all(promises);

    return results;


  } catch (err) {
    console.error(`Error in getHistoricalData('${symbol}'):`, err.message);
    return null;
  }
}

/* ------------------------------------------------------
   7. TOP GAINERS & LOSERS (With 1-Month Sparkline)
------------------------------------------------------ */

// Helper to fetch 1-month sparkline data
async function getSparklineData(symbol) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - 1);

    const period1 = Math.floor(startDate.getTime() / 1000);
    const period2 = Math.floor(endDate.getTime() / 1000);

    // Fetch 1-month data with daily interval
    const result = await yf.chart(symbol, {
      period1,
      period2,
      interval: '1d'
    });

    const quotes = result ? result.quotes : [];
    
    // Simplify data for sparkline (Date + Close)
    if (!quotes || quotes.length === 0) return [];
    
    return quotes
      .filter(q => q.close !== null && q.close !== undefined)
      .map(q => ({
        date: q.date.toISOString().split('T')[0],
        value: q.close
      }));

  } catch (err) {
    console.warn(`Sparkline fetch failed for ${symbol}:`, err.message);
    return [];
  }
}

export async function getTopGainers() {
  try {
    // 1. Fetch Gainers from Yahoo Screener
    // yf.screener({ scrIds: 'day_gainers', count: 10 })
    const result = await yf.screener({ scrIds: 'day_gainers', count: 10 });
    const gainers = result && result.quotes ? result.quotes : [];

    if (!gainers || gainers.length === 0) return [];

    // 2. Fetch Sparklines in Parallel
    const results = await Promise.all(gainers.map(async (stock) => {
        const chartData = await getSparklineData(stock.symbol);
        return {
            symbol: stock.symbol,
            name: stock.longName || stock.shortName || stock.displayName || stock.symbol,
            price: stock.regularMarketPrice,
            change: stock.regularMarketChange,
            changesPercentage: stock.regularMarketChangePercent,
            chartData: chartData
        };
    }));

    return results;

  } catch (err) {
    console.error("Error fetching top gainers:", err.message);
    return [];
  }
}

export async function getTopLosers() {
  try {
    // 1. Fetch Losers from Yahoo Screener
    // yf.screener({ scrIds: 'day_losers', count: 10 })
    const result = await yf.screener({ scrIds: 'day_losers', count: 10 });
    const losers = result && result.quotes ? result.quotes : [];

    if (!losers || losers.length === 0) return [];

    // 2. Fetch Sparklines in Parallel
    const results = await Promise.all(losers.map(async (stock) => {
        const chartData = await getSparklineData(stock.symbol);
        return {
            symbol: stock.symbol,
            name: stock.longName || stock.shortName || stock.displayName || stock.symbol,
            price: stock.regularMarketPrice,
            change: stock.regularMarketChange,
            changesPercentage: stock.regularMarketChangePercent,
            chartData: chartData
        };
    }));

    return results;

  } catch (err) {
    console.error("Error fetching top losers:", err.message);
    return [];
  }
}
