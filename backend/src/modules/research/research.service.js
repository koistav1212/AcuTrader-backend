import marketDataService from "../market/MarketDataService.js";
import newsService from "../news/news.service.js";
import forecastService from "../forecast/forecast.service.js";
import cacheService from "../market/cache/CacheService.js";
import { computeTechnicals } from "./technical.util.js";

class ResearchService {
  async getResearchForSymbol(symbol) {
    const cacheKey = `research:${symbol}`;
    const ttl = 300; // 5 minutes

    return cacheService.getOrSet(cacheKey, async () => {
      // Fetch components in parallel
      const [marketRes, historyRes, newsRes] = await Promise.allSettled([
        marketDataService.getQuote(symbol),
        marketDataService.getHistoricalData(symbol, "5y", "1d"),
        newsService.getNewsForSymbol(symbol, 30)
      ]);

      const market = marketRes.status === "fulfilled" ? (marketRes.value.data || {}) : {};
      const history = historyRes.status === "fulfilled" ? (historyRes.value.data || []) : [];
      const news = newsRes.status === "fulfilled" ? (newsRes.value || { window: "30d", articles: [] }) : { window: "30d", articles: [] };

      // Compute technicals
      const technicals = computeTechnicals(history);

      // Extract fundamentals explicitly
      const fundamentalKeys = [
        'marketCap', 'pe', 'forwardPE', 'trailingPE', 'pegRatio', 'priceToSales',
        'priceToBook', 'evToEBITDA', 'revenue', 'netIncome', 'profitMargin',
        'operatingMargin', 'returnOnEquity', 'totalCash', 'totalDebt',
        'debtToEquity', 'sector', 'industry'
      ];
      const fundamentals = {};
      let hasFundamentals = false;
      fundamentalKeys.forEach(key => {
        if (market[key] !== undefined && market[key] !== null) {
          fundamentals[key] = market[key];
          hasFundamentals = true;
        } else {
          fundamentals[key] = null;
        }
      });

      const sentiment = news.aggregate || {};

      // Build pipeline status
      const pipelineStatus = {
        market: {
          status: market.price ? 'ready' : 'missing',
          featureCount: Object.keys(market).length
        },
        ohlcv: {
          status: history.length >= 1000 ? 'ready' : 'insufficient',
          recordCount: history.length
        },
        technicals: {
          status: Object.keys(technicals).length > 5 ? 'ready' : 'missing',
          featureCount: Object.keys(technicals).length
        },
        fundamentals: {
          status: hasFundamentals ? 'ready' : 'missing',
          featureCount: fundamentalKeys.length
        },
        news: {
          status: news.articles?.length >= 5 ? 'ready' : (news.articles?.length > 0 ? 'partial' : 'missing'),
          recordCount: news.articles?.length || 0
        },
        sentiment: {
          status: sentiment.overallVerdict ? 'ready' : 'missing',
          featureCount: Object.keys(sentiment).length
        },
        forecast: {
          status: 'pending'
        }
      };

      // Pipeline Gating (Hard Validation)
      if (
        pipelineStatus.market.status === 'missing' ||
        pipelineStatus.technicals.status === 'missing' ||
        pipelineStatus.news.status === 'missing' ||
        pipelineStatus.sentiment.status === 'missing'
      ) {
        return {
          success: false,
          status: "insufficient_input_data",
          pipeline: {
            market: pipelineStatus.market.status,
            ohlcv: pipelineStatus.ohlcv.status,
            technicals: pipelineStatus.technicals.status,
            fundamentals: pipelineStatus.fundamentals.status,
            news: pipelineStatus.news.status,
            sentiment: pipelineStatus.sentiment.status
          },
          forecast: null,
          data: {
             pipelineStatus
          } // included for debugging
        };
      }

      const missingFeatures = [];
      if (pipelineStatus.fundamentals.status === 'missing') missingFeatures.push('fundamentals');
      if (pipelineStatus.news.status === 'partial') missingFeatures.push('sufficient_news');

      // Model Input Audit
      const forecastInput = {
        ohlcvRows: history.length,
        newsArticles: news.articles.length,
        sentimentArticles: news.articles.filter(a => a.sentimentScore !== undefined).length,
        technicalFeatures: Object.keys(technicals).length,
        fundamentalFeatures: Object.keys(fundamentals).filter(k => fundamentals[k] !== null).length,
        missingFeatures
      };
      
      console.log(`[ResearchService] forecastInput for ${symbol}:`, forecastInput);

      let forecast = null;
      if (history.length < 1000) {
        console.warn(`[Node] INSUFFICIENT_HISTORY for ${symbol}: ${history.length} rows`);
        pipelineStatus.forecast.status = 'INSUFFICIENT_HISTORY';
        forecast = {
          success: false,
          forecastStatus: "INSUFFICIENT_HISTORY"
        };
      } else {
        // Get forecast
        forecast = await forecastService.getForecastForSymbol(
          symbol,
          history,
          news.articles,
          technicals,
          fundamentals
        );
        pipelineStatus.forecast.status = forecast?.success ? 'ready' : 'failed';
      }

      return {
        success: true,
        symbol,
        market,
        technicals,
        fundamentals,
        news,
        sentiment,
        forecast,
        pipelineStatus
      };
    }, ttl);
  }
}

export default new ResearchService();
