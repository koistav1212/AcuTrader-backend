import BaseProvider from './BaseProvider.js';
import axios from 'axios';
import { normalizeQuote } from '../transformers/marketDataNormalizer.js';

export default class FinnhubProvider extends BaseProvider {
  constructor() {
    super('finnhub');
    this.apiKey = process.env.FINNHUB_API_KEY;
    this.baseUrl = 'https://finnhub.io/api/v1';
  }

  async getQuote(symbol) {
    if (!this.apiKey) return null;
    try {
      const response = await axios.get(`${this.baseUrl}/quote`, {
        params: { symbol, token: this.apiKey }
      });
      const data = response.data;
      if (data.c === 0 && data.h === 0) return null; // Finnhub returns 0s for invalid symbols
      data.symbol = symbol;
      return normalizeQuote(data, this.name);
    } catch (error) {
      console.error(`[FinnhubProvider] getQuote error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getFundamentals(symbol) {
    return null;
  }

  /**
   * Returns the raw Finnhub /quote API response without normalization.
   * Used by the quote aggregator in MarketDataService.
   */
  async getQuoteRaw(symbol) {
    if (!this.apiKey) return null;
    try {
      const response = await axios.get(`${this.baseUrl}/quote`, {
        params: { symbol, token: this.apiKey },
        timeout: 8000
      });
      const data = response.data;
      if (data.c === 0 && data.h === 0) return null; // Invalid symbol
      data.symbol = symbol;
      return data;
    } catch (error) {
      console.error(`[FinnhubProvider] getQuoteRaw error for ${symbol}:`, error.message);
      return null;
    }
  }
}
