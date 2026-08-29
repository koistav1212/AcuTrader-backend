import BaseProvider from './BaseProvider.js';
import YahooFinance from 'yahoo-finance2';
import { normalizeQuote, normalizeHistory } from '../transformers/marketDataNormalizer.js';

const yahooFinance = new YahooFinance();

export default class YahooProvider extends BaseProvider {
  constructor() {
    super('yahoo');
  }

  async getQuote(symbol) {
    try {
      const result = await yahooFinance.quote(symbol);
      return normalizeQuote(result, this.name);
    } catch (error) {
      console.error(`[YahooProvider] getQuote error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getHistoricalData(symbol, range = '1mo', interval = '1d') {
    try {
      // Yahoo finance 2 expects period1/period2. We'll map standard ranges to this.
      // For simplicity, using the `historical` method with start period mapped from range
      const queryOptions = { 
        period1: this._getPeriod1(range), 
        period2: new Date().toISOString().split('T')[0],
        interval 
      };
      const result = await yahooFinance.historical(symbol, queryOptions);
      return normalizeHistory(result, this.name);
    } catch (error) {
      console.error(`[YahooProvider] getHistoricalData error for ${symbol}:`, error.message);
      return null;
    }
  }

  async search(query) {
    try {
      const result = await yahooFinance.search(query);
      return result.quotes.filter(q => q.quoteType === 'EQUITY' || q.quoteType === 'ETF');
    } catch (error) {
      return [];
    }
  }

  async getMovers() {
    try {
      // Using generic market summary as proxy if movers is not natively accessible via yf2
      const result = await yahooFinance.trendingSymbols('US');
      const formatted = (result.quotes || []).map(q => ({
        symbol: q.symbol,
        name: q.shortName || q.symbol,
        price: q.regularMarketPrice || 0,
        change: q.regularMarketChange || 0,
        changePercent: q.regularMarketChangePercent || 0,
        volume: q.regularMarketVolume || 0
      }));
      return {
        gainers: [],
        losers: [],
        active: formatted
      };
    } catch (error) {
      return { gainers: [], losers: [], active: [] };
    }
  }

  _getPeriod1(range) {
    const now = new Date();
    switch (range) {
      case '1D': now.setDate(now.getDate() - 1); break;
      case '5D': now.setDate(now.getDate() - 5); break;
      case '1M': now.setMonth(now.getMonth() - 1); break;
      case '3M': now.setMonth(now.getMonth() - 3); break;
      case '6M': now.setMonth(now.getMonth() - 6); break;
      case '1Y': now.setFullYear(now.getFullYear() - 1); break;
      case '5Y': now.setFullYear(now.getFullYear() - 5); break;
      case '10Y': now.setFullYear(now.getFullYear() - 10); break;
      default: now.setMonth(now.getMonth() - 1);
    }
    return now.toISOString().split('T')[0]; // Use YYYY-MM-DD
  }

  async getFundamentals(symbol) {
    return null;
  }
}
