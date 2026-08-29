import BaseProvider from './BaseProvider.js';
import axios from 'axios';
import { config } from '../../../config/env.js';

export default class PythonMarketProvider extends BaseProvider {
  constructor() {
    super('python_yfinance');
    this.baseUrl = `${config.pythonServiceUrl}/internal/market`;
  }

  async getQuote(symbol) {
    // We only use Python for historical data currently
    return null;
  }

  async getHistoricalData(symbol, range, interval) {
    try {
      // Map range
      const rangeMap = {
        '1D': '1d', '5D': '5d', '1M': '1mo', '3M': '3mo', '6M': '6mo',
        '1Y': '1y', '2Y': '2y', '5Y': '5y', '10Y': '10y', 'MAX': 'max', 'ALL': 'max'
      };
      const pyRange = rangeMap[(range || '').toUpperCase()] || range;

      // 10 second timeout max to ensure quick fallback
      const response = await axios.get(`${this.baseUrl}/history`, {
        params: { symbol, range: pyRange, interval },
        timeout: 10000 
      });

      const result = response.data;

      // Ensure data is valid
      if (!result || !result.success || !Array.isArray(result.data)) {
        throw new Error('Python provider returned invalid or empty data format');
      }

      let candles = result.data.map(candle => ({
        date: candle.timestamp || candle.date,
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close),
        adjClose: Number(candle.close),
        volume: Number(candle.volume) || 0
      }));

      // Validate data quality
      candles = candles.filter(c => c.date && !isNaN(new Date(c.date).getTime()) && !isNaN(c.close));
      
      // Sort ascending
      candles.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Deduplicate timestamps
      const uniqueCandles = [];
      const seen = new Set();
      for (const c of candles) {
        const time = new Date(c.date).getTime();
        if (!seen.has(time)) {
          seen.add(time);
          uniqueCandles.push(c);
        }
      }
      candles = uniqueCandles;

      if (candles.length === 0) {
        throw new Error('Python provider returned empty results after filtering');
      }

      // Reject insufficient results
      const r = (range || '').toUpperCase();
      const intv = (interval || '').toLowerCase();
      let minExpected = 1;
      
      if (r === '1D' && intv === '5m') minExpected = 20; // trading day has 78 5m candles
      else if (r === '1D' && intv === '15m') minExpected = 10;
      else if (r === '5D') minExpected = 20;
      else if (r === '1M') minExpected = 15;
      else if (r === '1Y') minExpected = 100;
      
      if (candles.length < minExpected) {
        throw new Error(`Insufficient data points: ${candles.length} (expected at least ${minExpected})`);
      }

      console.log(`[History] provider=python_yfinance points=${candles.length}`);
      return candles;

    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        console.warn(`[PythonMarketProvider] Timeout fetching history for ${symbol}`);
      } else {
        console.warn(`[PythonMarketProvider] Error fetching history for ${symbol}:`, error.message);
      }
      return null; // Force fallback
    }
  }

  async search(query) {
    return null;
  }

  async getMovers() {
    return null;
  }
}
