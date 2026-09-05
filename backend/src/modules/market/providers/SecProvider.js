import axios from 'axios';
import BaseProvider from './BaseProvider.js';

export default class SecProvider extends BaseProvider {
  constructor() {
    super('sec');
    this.tickersUrl = 'https://www.sec.gov/files/company_tickers.json';
    this.factsUrlPrefix = 'https://data.sec.gov/api/xbrl/companyfacts/CIK';
    // Must provide a legitimate User-Agent for SEC EDGAR
    this.headers = {
      'User-Agent': 'AcuTrader backend@example.com',
      'Accept-Encoding': 'gzip, deflate'
    };
    this.cikMap = null; // Memory cache for ticker -> CIK mapping
    this.cikMapFetchedAt = null;
  }

  async _getCikMap() {
    // Cache the mapping for 24 hours in memory
    const now = Date.now();
    if (this.cikMap && this.cikMapFetchedAt && now - this.cikMapFetchedAt < 24 * 60 * 60 * 1000) {
      return this.cikMap;
    }
    try {
      const res = await axios.get(this.tickersUrl, { headers: this.headers, timeout: 10000 });
      const map = {};
      Object.values(res.data).forEach(entry => {
        map[entry.ticker.toUpperCase()] = entry.cik_str;
      });
      this.cikMap = map;
      this.cikMapFetchedAt = now;
      return map;
    } catch (err) {
      console.warn('[SecProvider] Failed to fetch CIK map:', err.message);
      return this.cikMap || {}; // Fallback to stale map if available
    }
  }

  /**
   * Fetch SEC XBRL facts for a given symbol.
   */
  async getQuoteRaw(symbol) {
    const sym = symbol.toUpperCase();
    const map = await this._getCikMap();
    const cik = map[sym];
    
    if (!cik) {
      // SEC does not have data for non-US/non-reporting companies
      return null;
    }

    // Pad CIK to 10 digits as required by SEC API
    const paddedCik = String(cik).padStart(10, '0');
    const url = `${this.factsUrlPrefix}${paddedCik}.json`;

    try {
      const response = await axios.get(url, { headers: this.headers, timeout: 15000 });
      return {
        symbol: sym,
        cik: paddedCik,
        facts: response.data?.facts?.['us-gaap'] || {}
      };
    } catch (err) {
      if (err.response && err.response.status === 404) {
        // Not found is normal for some tickers without XBRL
        return null;
      }
      console.warn(`[SecProvider] getQuoteRaw error for ${sym}:`, err.message);
      return null;
    }
  }

  // BaseProvider stubs
  async getQuote(symbol) { return null; }
  async getHistoricalData(symbol, range, interval) { return null; }
  async search(query) { return []; }
  async getMovers() { return { gainers: [], losers: [], active: [] }; }
}
