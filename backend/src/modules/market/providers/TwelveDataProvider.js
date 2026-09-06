import BaseProvider from './BaseProvider.js';
import axios from 'axios';
import { normalizeQuote, normalizeHistory } from '../transformers/marketDataNormalizer.js';

export default class TwelveDataProvider extends BaseProvider {
  constructor() {
    super('twelvedata');
    this.apiKey = process.env.TWELVEDATA_KEY;
    this.baseUrl = 'https://api.twelvedata.com';
  }

  async getQuote(symbol) {
    if (!this.apiKey) return null;
    try {
      const response = await axios.get(`${this.baseUrl}/quote`, {
        params: { symbol, apikey: this.apiKey }
      });
      if (response.data.code && response.data.code >= 400) return null;
      return normalizeQuote(response.data, this.name);
    } catch (error) {
      console.error(`[TwelveDataProvider] getQuote error:`, error.message);
      return null;
    }
  }

  async getHistoricalData(symbol, range = '1mo', interval = '1day') {
    if (!this.apiKey) return null;
    try {
      // Map interval to twelvedata standard (1min, 5min, 1h, 1day)
      let tdInterval = '1day';
      if (interval === '1m') tdInterval = '1min';
      if (interval === '5m') tdInterval = '5min';
      if (interval === '1h') tdInterval = '1h';
      if (interval === '1wk') tdInterval = '1week';
      if (interval === '1mo') tdInterval = '1month';

      // Calculate output size based on range
      const r = (range || '').toUpperCase();
      let outputsize = 100;
      if (r === '1Y') outputsize = 260;
      if (r === '5Y') outputsize = 1300;
      if (r === '10Y' || r === 'MAX') outputsize = 2600;

      const response = await axios.get(`${this.baseUrl}/time_series`, {
        params: { symbol, interval: tdInterval, apikey: this.apiKey, outputsize }
      });
      if (response.data.code && response.data.code >= 400) return null;
      if (!response.data.values) return [];
      
      return response.data.values.map(c => ({
        date: new Date(c.datetime).toISOString(),
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        adjClose: parseFloat(c.close),
        volume: parseInt(c.volume, 10)
      })).reverse();
    } catch (error) {
      console.error(`[TwelveDataProvider] getHistoricalData error:`, error.message);
      return null;
    }
  }

  async search(query) {
    if (!this.apiKey) return null;
    try {
      const response = await axios.get(`${this.baseUrl}/symbol_search`, {
        params: { symbol: query }
      });
      if (response.data.data) {
         return response.data.data.map(s => ({
            symbol: s.symbol,
            instrument_name: s.instrument_name,
            exchange: s.exchange
         }));
      }
      return [];
    } catch (error) {
       return null;
    }
  }

  async getMovers() {
     // Twelve Data doesn't have a direct movers API in the free tier, proxy with AAPL, TSLA, MSFT
     const active = [
        await this.getQuote('AAPL'),
        await this.getQuote('TSLA'),
        await this.getQuote('MSFT')
     ].filter(Boolean).map(q => ({
        symbol: q.symbol,
        name: q.symbol,
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
        volume: q.volume
     }));
     return { gainers: [], losers: [], active };
  }

  async getFundamentals(symbol) {
    return null;
  }

  /**
   * Returns the raw TwelveData /quote API response without normalization.
   * Used by the quote aggregator in MarketDataService.
   */
  async getQuoteRaw(symbol) {
    if (!this.apiKey) return null;
    try {
      const response = await axios.get(`${this.baseUrl}/quote`, {
        params: { symbol, apikey: this.apiKey },
        timeout: 8000
      });
      if (response.data.code && response.data.code >= 400) return null;
      return response.data;
    } catch (error) {
      console.error(`[TwelveDataProvider] getQuoteRaw error for ${symbol}:`, error.message);
      return null;
    }
  }
}
