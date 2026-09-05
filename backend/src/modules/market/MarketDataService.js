import cacheService from './cache/CacheService.js';
import providerRouter from './ProviderRouter.js';
import {
  normalizeQuote,
  mergeQuoteFields,
  computeDerivedMetrics,
  computeDataQuality,
  buildSourceString
} from './transformers/quoteNormalizer.js';

// Direct provider references for quote aggregation
import TwelveDataProvider from './providers/TwelveDataProvider.js';
import YahooProvider from './providers/YahooProvider.js';
import FinnhubProvider from './providers/FinnhubProvider.js';
import AlphaVantageProvider from './providers/AlphaVantageProvider.js';
import SecProvider from './providers/SecProvider.js';

const twelveDataProvider = new TwelveDataProvider();
const alphaVantageProvider = new AlphaVantageProvider();
const secProvider = new SecProvider();
const yahooProvider = new YahooProvider();
const finnhubProvider = new FinnhubProvider();

class MarketDataService {
  async getQuote(symbol, debug = false) {
    const SYM = symbol.toUpperCase();
    const cacheKey = `quote:${SYM}:merged`;
    const cacheTtl = 20; // 20 seconds for fast quotes
    
    // We only skip cache if debug is true, so we can see fresh diagnostic data
    if (!debug) {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    // ── Fetch all providers in parallel ────────────────────────────────
    console.log(`[QuoteAggregator] Fetching ${SYM} from all providers...`);
    const startTime = Date.now();

    const [twelveDataResult, alphaVantageResult, secResult, yahooResult, finnhubResult] = await Promise.allSettled([
      twelveDataProvider.getQuoteRaw(SYM),
      alphaVantageProvider.getQuoteRaw(SYM),
      secProvider.getQuoteRaw(SYM),
      yahooProvider.getQuoteRaw(SYM), // Kept as fallback, without scraping
      finnhubProvider.getQuoteRaw(SYM)
    ]);

    const raw = {
      twelvedata: twelveDataResult.status === 'fulfilled' ? twelveDataResult.value : null,
      alphavantage: alphaVantageResult.status === 'fulfilled' ? alphaVantageResult.value : null,
      sec: secResult.status === 'fulfilled' ? secResult.value : null,
      yahoo: yahooResult.status === 'fulfilled' ? yahooResult.value : null,
      finnhub: finnhubResult.status === 'fulfilled' ? finnhubResult.value : null,
    };

    // Log provider status
    const providerStatus = {
      twelvedata: raw.twelvedata ? 'OK' : (twelveDataResult.status === 'rejected' ? `FAIL: ${twelveDataResult.reason?.message}` : 'NULL'),
      alphavantage: raw.alphavantage ? 'OK' : (alphaVantageResult.status === 'rejected' ? `FAIL: ${alphaVantageResult.reason?.message}` : 'NULL'),
      sec: raw.sec ? 'OK' : (secResult.status === 'rejected' ? `FAIL: ${secResult.reason?.message}` : 'NULL'),
      yahoo: raw.yahoo ? 'OK' : (yahooResult.status === 'rejected' ? `FAIL: ${yahooResult.reason?.message}` : 'NULL'),
      finnhub: raw.finnhub ? 'OK' : (finnhubResult.status === 'rejected' ? `FAIL: ${finnhubResult.reason?.message}` : 'NULL')
    };
    console.log(`[QuoteAggregator] Provider status for ${SYM}:`, providerStatus);

    // If ALL quote providers failed, return error
    if (!raw.twelvedata && !raw.alphavantage && !raw.yahoo && !raw.finnhub) {
      const error = new Error(`Quote data unavailable for ${SYM}. All providers failed.`);
      error.status = 404;
      throw error;
    }

    // ── Normalize each to canonical schema ─────────────────────────────
    const normalized = {
      twelvedata: raw.twelvedata ? normalizeQuote('twelvedata', raw.twelvedata, SYM) : null,
      alphavantage: raw.alphavantage ? normalizeQuote('alphavantage', raw.alphavantage, SYM) : null,
      sec: raw.sec ? normalizeQuote('sec', raw.sec, SYM) : null,
      yahoo: raw.yahoo ? normalizeQuote('yahoo', raw.yahoo, SYM) : null,
      finnhub: raw.finnhub ? normalizeQuote('finnhub', raw.finnhub, SYM) : null
    };

    // ── Merge with field-level priority ────────────────────────────────
    const { merged, fieldSources, fieldAsOf, providersUsed, sourceDiscrepancies } = mergeQuoteFields(normalized);

    // ── Compute derived metrics ────────────────────────────────────────
    computeDerivedMetrics(merged);

    // ── Data quality ───────────────────────────────────────────────────
    merged.dataQuality = computeDataQuality(merged, providersUsed, sourceDiscrepancies);
    merged.fieldSources = fieldSources;
    merged.fieldAsOf = fieldAsOf;
    merged.source = buildSourceString(providersUsed);
    merged.updatedAt = new Date().toISOString();

    const elapsed = Date.now() - startTime;
    console.log(`[QuoteAggregator] ${SYM} merged in ${elapsed}ms — source: ${merged.source}, completeness: ${merged.dataQuality.completeness}%`);

    const result = {
      data: merged,
      source: merged.source,
      cached: false,
      updatedAt: merged.updatedAt
    };

    // Include debug diagnostic if requested
    if (debug) {
      result.diagnostic = {
        providerStatus,
        sourceDiscrepancies,
        raw
      };
    }

    // ── Cache the final merged result ──────────────────────────────────
    if (!debug) {
      await cacheService.set(cacheKey, result, cacheTtl);
    }

    return result;
  }

  _getDynamicTTL(range, interval) {
    const rangeUpper = (range || '1mo').toUpperCase();
    const isIntraday = ['1M', '2M', '5M', '10M', '15M', '30M', '1H'].includes((interval || '').toUpperCase());

    if (rangeUpper === '1D') {
      if (interval === '1m') return 60;
      if (interval === '5m' || interval === '10m') return 120;
      if (interval === '15m' || interval === '30m') return 300;
      return 300;
    }
    
    if (rangeUpper === '5D') return 300; // 5 mins
    
    if (['1M', '3M', '6M'].includes(rangeUpper)) return 3600; // 1 hour
    
    if (rangeUpper === '1Y') return 14400; // 4 hours
    
    if (['5Y', '10Y', 'YTD', 'MAX'].includes(rangeUpper)) return 43200; // 12 hours
    
    return 300; // Default 5 mins
  }

  _getIntervalFallbacks(range, requestedInterval) {
    const r = (range || '1mo').toUpperCase();
    const req = (requestedInterval || '1d').toLowerCase();

    let chain = [];
    if (r === '1D') chain = ['5m', '15m', '30m', '1d'];
    else if (r === '5D') chain = ['15m', '30m', '1h', '1d'];
    else if (r === '1M' || r === '3M' || r === '6M') chain = ['1h', '1d'];
    else if (['1Y', '2Y', '3Y', '4Y', '5Y'].includes(r)) chain = ['1d'];
    else if (r === '10Y') chain = ['1wk'];
    else if (r === 'MAX' || r === 'ALL') chain = ['1mo'];
    else chain = ['1d'];

    let startIndex = chain.indexOf(req);
    if (startIndex !== -1) {
      if (req === '1d' && ['1D', '5D', '1M', '3M', '6M'].includes(r)) {
        startIndex = 0; // force intraday preferred
      }
    } else {
      startIndex = 0;
    }

    return chain.slice(startIndex);
  }

  async getHistoricalData(symbol, range = '1mo', interval = '1d') {
    const chain = this._getIntervalFallbacks(range, interval);
    console.log(`[History] symbol=${symbol} range=${range} requestedInterval=${interval}`);

    for (const resolvedInterval of chain) {
      const cacheKey = `history:${symbol}:${range}:${resolvedInterval}`;
      const ttl = this._getDynamicTTL(range, resolvedInterval);

      try {
        const data = await cacheService.getOrSet(cacheKey, async () => {
          console.log(`[History] resolvedInterval=${resolvedInterval}`);
          const result = await providerRouter.executeWithFallback('history', [symbol, range, resolvedInterval]);
          return { ...result, cached: false, updatedAt: new Date().toISOString() };
        }, ttl);

        if (!data.cached && data.updatedAt && new Date() - new Date(data.updatedAt) > 500) {
          data.cached = true;
        }
        
        return data;
      } catch (error) {
        // Fallback to next interval if all providers fail for this interval
      }
    }

    // If we exhaust the interval fallback chain
    throw new Error(`All interval fallbacks failed for historical data. Symbol: ${symbol}, Range: ${range}`);
  }

  async searchSymbol(query) {
    const cacheKey = `search:${query}`;
    const ttl = 3600; // 1 hour

    return cacheService.getOrSet(cacheKey, async () => {
      // 1. Search local catalog first
      try {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        const normalizedQuery = query.trim().toUpperCase();

        const results = await prisma.symbol_catalog.findMany({
          where: {
            OR: [
              { symbol: { startsWith: normalizedQuery, mode: 'insensitive' } },
              { name: { contains: query, mode: 'insensitive' } }
            ],
            is_active: true,
            exchange: { in: ['NASDAQ', 'NYSE'] }
          },
          take: 15
        });

        if (results.length > 0) {
          // Ranking logic: exact symbol > symbol startsWith > name startsWith > name contains
          const ranked = results.map(r => {
            let score = 0;
            const sym = r.symbol.toUpperCase();
            const n = r.name.toLowerCase();
            const q = query.toLowerCase();

            if (sym === normalizedQuery) score = 100;
            else if (sym.startsWith(normalizedQuery)) score = 90;
            else if (n.startsWith(q)) score = 80;
            else score = 70;

            return { ...r, _score: score };
          }).sort((a, b) => b._score - a._score);

          await prisma.$disconnect();

          return {
            data: ranked.map(r => ({
              symbol: r.symbol,
              name: r.name,
              exchange: r.exchange,
              type: r.type,
              country: r.country
            })),
            cached: false,
            updatedAt: new Date().toISOString(),
            source: 'local_catalog'
          };
        }
        await prisma.$disconnect();
      } catch (dbError) {
        console.warn("Local DB search failed, falling back to provider:", dbError.message);
      }

      // 2. Fallback to provider if local search yields no results or fails
      const result = await providerRouter.executeWithFallback('search', [query]);
      
      // Filter provider results to NASDAQ/NYSE and normalize
      if (result && result.data) {
        result.data = result.data.filter(s => 
          s.exchange === 'NASDAQ' || s.exchange === 'NYSE' || s.exchange === 'NMS' || s.exchange === 'NasdaqGS'
        ).map(s => ({
          symbol: s.symbol,
          name: s.instrument_name || s.shortName || s.longName,
          exchange: (s.exchange === 'NasdaqGS' || s.exchange === 'NMS') ? 'NASDAQ' : s.exchange,
          type: s.quoteType || 'EQUITY',
          country: 'US'
        })).slice(0, 15);
      }

      return { ...result, cached: false, updatedAt: new Date().toISOString() };
    }, ttl);
  }

  async getMovers() {
    const cacheKey = `movers:top`;
    const ttl = 60; // 60 seconds

    return cacheService.getOrSet(cacheKey, async () => {
      const result = await providerRouter.executeWithFallback('movers', []);
      
      try {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        
        if (result.data) {
           const allSymbols = [
             ...(result.data.gainers || []).map(g => g.symbol),
             ...(result.data.losers || []).map(l => l.symbol),
             ...(result.data.active || []).map(a => a.symbol)
           ];
           
           if (allSymbols.length > 0) {
             const catalog = await prisma.symbol_catalog.findMany({
               where: { symbol: { in: allSymbols } },
               select: { symbol: true, name: true }
             });
             
             const nameMap = {};
             catalog.forEach(item => {
               nameMap[item.symbol] = item.name;
             });
             
             const enrichList = (list = []) => list.map(item => ({
               ...item,
               name: nameMap[item.symbol] || item.name
             }));
             
             result.data.gainers = enrichList(result.data.gainers);
             result.data.losers = enrichList(result.data.losers);
             result.data.active = enrichList(result.data.active);
           }
        }
        await prisma.$disconnect();
      } catch (dbError) {
        console.warn("Failed to enrich movers with names from DB, using Python fallback:", dbError.message);
        try {
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          
          if (result.data) {
             const allSymbols = [
               ...(result.data.gainers || []).map(g => g.symbol),
               ...(result.data.losers || []).map(l => l.symbol),
               ...(result.data.active || []).map(a => a.symbol)
             ];
             
             if (allSymbols.length > 0) {
                const symStr = allSymbols.join(' ');
                const pyScript = `
import yfinance as yf
import json
import concurrent.futures

tickers = '${symStr}'.split()

def get_name(sym):
    try:
        t = yf.Ticker(sym)
        return t.info.get('shortName', sym)
    except:
        return sym

out = {}
with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
    futures = {executor.submit(get_name, sym): sym for sym in tickers}
    try:
        for future in concurrent.futures.as_completed(futures, timeout=10):
            sym = futures[future]
            try:
                out[sym] = future.result()
            except:
                out[sym] = sym
    except concurrent.futures.TimeoutError:
        pass

for sym in tickers:
    if sym not in out:
        out[sym] = sym

print(json.dumps(out))
`;
                const { stdout } = await execAsync(`python3 -c "${pyScript}"`, { timeout: 15000 });
                const nameMap = JSON.parse(stdout);
                
                const enrichList = (list = []) => list.map(item => ({
                  ...item,
                  name: nameMap[item.symbol] || item.name
                }));
                
                result.data.gainers = enrichList(result.data.gainers);
                result.data.losers = enrichList(result.data.losers);
                result.data.active = enrichList(result.data.active);
             }
          }
        } catch (pyErr) {
          console.warn("Python yfinance fallback failed:", pyErr.message);
        }
      }

      return { ...result, cached: false, updatedAt: new Date().toISOString() };
    }, ttl);
  }

  async getTrending() {
    const cacheKey = `trending:top`;
    const ttl = 300; // 5 mins

    return cacheService.getOrSet(cacheKey, async () => {
      try {
        const { getTrendingStocks } = await import('../../services/twelveDataService.js');
        const data = await getTrendingStocks();
        return { data, cached: false, updatedAt: new Date().toISOString() };
      } catch (error) {
        console.error("Failed to fetch trending stocks:", error.message);
        return { data: [], cached: false, updatedAt: new Date().toISOString() };
      }
    }, ttl);
  }
}

export default new MarketDataService();
