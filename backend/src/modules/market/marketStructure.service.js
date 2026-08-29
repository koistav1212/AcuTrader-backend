import marketDataService from './MarketDataService.js';
import cacheService from './cache/CacheService.js';
import { calculateSMA } from '../../utils/indicators.js';
import { SECTOR_ETFS, BREADTH_UNIVERSE } from './marketUniverse.js';

export function calculateMarketBreadth(quotes, histories) {
  let advancers = 0;
  let decliners = 0;
  let unchanged = 0;
  let above50DMA = 0;
  let above200DMA = 0;

  // Process Quotes for Advancers/Decliners
  quotes.forEach(quote => {
    if (quote && typeof quote.changePercent === 'number') {
      if (quote.changePercent > 0) advancers++;
      else if (quote.changePercent < 0) decliners++;
      else unchanged++;
    }
  });

  // Process Histories for SMAs
  histories.forEach(historyItem => {
    if (historyItem && historyItem.data && historyItem.data.length > 0) {
      const data = historyItem.data;
      // Sort by date ascending to get SMA of most recent
      const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
      const closePrices = sortedData.map(d => d.close);
      
      const latestPrice = closePrices[closePrices.length - 1];

      if (closePrices.length >= 50) {
        const sma50Array = calculateSMA(closePrices, 50);
        const latestSMA50 = sma50Array[sma50Array.length - 1];
        if (latestSMA50 && latestPrice > latestSMA50) {
          above50DMA++;
        }
      }

      if (closePrices.length >= 200) {
        const sma200Array = calculateSMA(closePrices, 200);
        const latestSMA200 = sma200Array[sma200Array.length - 1];
        if (latestSMA200 && latestPrice > latestSMA200) {
          above200DMA++;
        }
      }
    }
  });

  const advanceDeclineRatio = decliners > 0 ? Number((advancers / decliners).toFixed(2)) : advancers;

  return {
    advancers,
    decliners,
    unchanged,
    advanceDeclineRatio,
    above50DMA,
    above200DMA
  };
}

export function calculateSectorPerformance(sectorQuotes) {
  return sectorQuotes.map(quote => {
    if (!quote) return null;
    return {
      sector: quote.symbol, // E.g., XLK
      symbol: quote.symbol,
      returnPercent: quote.changePercent || 0
    };
  }).filter(Boolean);
}

class MarketStructureService {
  async getMarketStructure() {
    const cacheKey = 'market:structure';
    const ttl = 60; // Cache the final result for 60 seconds

    return cacheService.getOrSet(cacheKey, async () => {
      // 1. Fetch quotes for breadth
      const breadthQuotesPromises = BREADTH_UNIVERSE.map(symbol => marketDataService.getQuote(symbol));
      
      // 2. Fetch history for breadth SMAs (cache these calls for 12 hours individually)
      const breadthHistoriesPromises = BREADTH_UNIVERSE.map(symbol => {
        const historyCacheKey = `sma_history:${symbol}`;
        return cacheService.getOrSet(historyCacheKey, async () => {
          return marketDataService.getHistoricalData(symbol, '1Y', '1d');
        }, 12 * 3600);
      });

      // 3. Fetch quotes for sectors
      const sectorQuotesPromises = SECTOR_ETFS.map(symbol => marketDataService.getQuote(symbol));

      // Execute all fetches concurrently, handling individual failures
      const [breadthQuotesResults, breadthHistoriesResults, sectorQuotesResults] = await Promise.all([
        Promise.allSettled(breadthQuotesPromises),
        Promise.allSettled(breadthHistoriesPromises),
        Promise.allSettled(sectorQuotesPromises)
      ]);

      const quotes = breadthQuotesResults
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value.data || r.value);
        
      const histories = breadthHistoriesResults
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);

      const sectorQuotes = sectorQuotesResults
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value.data || r.value);

      const breadth = calculateMarketBreadth(quotes, histories);
      const sectors = calculateSectorPerformance(sectorQuotes);

      return {
        updatedAt: new Date().toISOString(),
        breadth,
        sectors
      };
    }, ttl);
  }
}

export default new MarketStructureService();
