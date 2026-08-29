import YahooProvider from './providers/YahooProvider.js';
import AlphaVantageProvider from './providers/AlphaVantageProvider.js';
import FinnhubProvider from './providers/FinnhubProvider.js';
import TwelveDataProvider from './providers/TwelveDataProvider.js';
import PythonMarketProvider from './providers/PythonMarketProvider.js';

class ProviderRouter {
  constructor() {
    this.providers = {
      python_yfinance: new PythonMarketProvider(),
      yahoo: new YahooProvider(),
      alphavantage: new AlphaVantageProvider(),
      finnhub: new FinnhubProvider(),
      twelvedata: new TwelveDataProvider()
    };
    
    // Primary -> Secondary logic
    this.routingConfig = {
      quote: ['twelvedata', 'alphavantage', 'finnhub', 'yahoo'],
      history: ['python_yfinance', 'twelvedata', 'alphavantage', 'yahoo'],
      search: ['twelvedata', 'yahoo'], // twelve data search is complex, usually just return symbol directly but let's mock search or fallback
      movers: ['alphavantage', 'twelvedata', 'yahoo'],
      fundamentals: ['alphavantage', 'finnhub', 'yahoo']
    };
  }

  async executeWithFallback(operation, args) {
    const providersToTry = this.routingConfig[operation];
    
    for (const providerKey of providersToTry) {
      const provider = this.providers[providerKey];
      try {
        let result;
        switch (operation) {
          case 'quote':
            result = await provider.getQuote(...args);
            break;
          case 'history':
            result = await provider.getHistoricalData(...args);
            break;
          case 'search':
            result = await provider.search(...args);
            break;
          case 'movers':
            result = await provider.getMovers(...args);
            break;
          case 'fundamentals':
            result = await provider.getFundamentals(...args);
            break;
        }

        if (result && (!Array.isArray(result) || result.length > 0)) {
          return { data: result, source: providerKey };
        }
      } catch (error) {
        console.warn(`[ProviderRouter] ${providerKey} failed for ${operation}:`, error.message);
      }
    }
    
    const error = new Error(`Market data unavailable for operation: ${operation}. Symbol may be invalid or unsupported.`);
    error.status = 404;
    throw error;
  }
}

export default new ProviderRouter();
