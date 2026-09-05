import BaseProvider from './BaseProvider.js';
import axios from 'axios';
import { normalizeQuote } from '../transformers/marketDataNormalizer.js';

export default class AlphaVantageProvider extends BaseProvider {
  constructor() {
    super('alphavantage');
    this.apiKey = process.env.ALPHA_VANTAGE_KEY;
    this.baseUrl = 'https://www.alphavantage.co/query';
  }

  async getQuote(symbol) {
    if (!this.apiKey) return null;
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol,
          apikey: this.apiKey
        }
      });
      return normalizeQuote(response.data, this.name);
    } catch (error) {
      console.error(`[AlphaVantageProvider] getQuote error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getHistoricalData(symbol, range, interval) {
    // Basic implementation, would need mapping for ranges and intervals
    return null;
  }

  async getMovers() {
    if (!this.apiKey) return null;
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'TOP_GAINERS_LOSERS',
          apikey: this.apiKey
        }
      });
      
      const data = response.data;
      if (!data || !data.top_gainers) return null;

      const formatMover = (item) => ({
        symbol: item.ticker,
        name: item.ticker,
        price: parseFloat(item.price) || 0,
        change: parseFloat(item.change_amount) || 0,
        changePercent: parseFloat((item.change_percentage || '0').replace('%', '')) || 0,
        volume: parseInt(item.volume, 10) || 0
      });

      return {
        gainers: data.top_gainers.map(formatMover),
        losers: data.top_losers.map(formatMover),
        active: data.most_actively_traded.map(formatMover)
      };
    } catch (error) {
      console.error(`[AlphaVantageProvider] getMovers error:`, error.message);
      return null;
    }
  }

  async getFundamentals(symbol) {
    if (!this.apiKey) return null;
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'OVERVIEW',
          symbol,
          apikey: this.apiKey
        }
      });
      const data = response.data;
      if (!data || !data.Symbol) return null;

      return {
        marketCap: data.MarketCapitalization ? parseFloat(data.MarketCapitalization) : null,
        peRatio: data.PERatio ? parseFloat(data.PERatio) : null,
        forwardPE: data.ForwardPE ? parseFloat(data.ForwardPE) : null,
        trailingPE: data.TrailingPE ? parseFloat(data.TrailingPE) : null,
        eps: data.EPS ? parseFloat(data.EPS) : null,
        dividendYield: data.DividendYield ? parseFloat(data.DividendYield) : null,
        sector: data.Sector || null,
        industry: data.Industry || null,
        enterpriseValue: data.EBITDA ? parseFloat(data.EBITDA) : null, // Proxy or we can map EV
        pegRatio: data.PEGRatio ? parseFloat(data.PEGRatio) : null,
        priceToSales: data.PriceToSalesRatioTTM ? parseFloat(data.PriceToSalesRatioTTM) : null,
        priceToBook: data.PriceToBookRatio ? parseFloat(data.PriceToBookRatio) : null,
        evToEBITDA: data.EVToEBITDA ? parseFloat(data.EVToEBITDA) : null,
        revenue: data.RevenueTTM ? parseFloat(data.RevenueTTM) : null,
        netIncome: data.GrossProfitTTM ? parseFloat(data.GrossProfitTTM) : null, // Proxy
        profitMargin: data.ProfitMargin ? parseFloat(data.ProfitMargin) : null,
        returnOnEquity: data.ReturnOnEquityTTM ? parseFloat(data.ReturnOnEquityTTM) : null,
        analystRating: data.AnalystTargetPrice ? data.AnalystTargetPrice : null, // Map target price to rating placeholder if needed
        targetPrice: data.AnalystTargetPrice ? parseFloat(data.AnalystTargetPrice) : null,
        earningsDate: data.DividendDate || null
      };
    } catch (error) {
      console.error(`[AlphaVantageProvider] getFundamentals error:`, error.message);
      return null;
    }
  }

  /**
   * Returns raw Alpha Vantage data (OVERVIEW) for the quote aggregator.
   */
  async getQuoteRaw(symbol) {
    if (!this.apiKey) return null;
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'OVERVIEW',
          symbol,
          apikey: this.apiKey
        },
        timeout: 10000
      });
      const data = response.data;
      if (!data || Object.keys(data).length === 0 || data.Information) {
        return null;
      }
      data.symbol = symbol;
      return data;
    } catch (error) {
      console.error(`[AlphaVantageProvider] getQuoteRaw error for ${symbol}:`, error.message);
      return null;
    }
  }
}
