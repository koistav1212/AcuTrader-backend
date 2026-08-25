import marketDataService from "../market/MarketDataService.js";
import newsService from "../news/news.service.js";
import forecastService from "../forecast/forecast.service.js";
import cacheService from "../market/cache/CacheService.js";

class ResearchService {
  async getResearchForSymbol(symbol) {
    const cacheKey = `research:${symbol}`;
    const ttl = 300; // 5 minutes

    return cacheService.getOrSet(cacheKey, async () => {
      // Fetch components in parallel
      const [marketRes, historyRes, newsRes] = await Promise.allSettled([
        marketDataService.getQuote(symbol),
        marketDataService.getHistoricalData(symbol, "1M", "1d"),
        newsService.getNewsForSymbol(symbol, 30)
      ]);

      const market = marketRes.status === "fulfilled" ? (marketRes.value.data || {}) : {};
      const history = historyRes.status === "fulfilled" ? (historyRes.value.data || []) : [];
      const news = newsRes.status === "fulfilled" ? newsRes.value : { window: "30d", articles: [] };

      // Fundamentals are extracted from market data (or quote if merged)
      const fundamentals = {}; // Could extract specific keys from market

      // Extract technicals placeholder
      const technicals = {};

      // Get forecast
      const forecast = await forecastService.getForecastForSymbol(
        symbol,
        history,
        news.articles,
        technicals,
        fundamentals
      );

      return {
        symbol,
        market,
        technicals,
        fundamentals,
        news,
        sentiment: {},
        forecast
      };
    }, ttl);
  }
}

export default new ResearchService();
