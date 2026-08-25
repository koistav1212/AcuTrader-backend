import marketDataService from './MarketDataService.js';
import axios from 'axios';
import { config } from '../../config/env.js';

class MarketFacadeService {
  async getQuote(symbol) {
    return marketDataService.getQuote(symbol);
  }

  async getHistoricalData(symbol, range, interval) {
    return marketDataService.getHistoricalData(symbol, range, interval);
  }

  async searchSymbol(query) {
    return marketDataService.searchSymbol(query);
  }

  async getMovers() {
    return marketDataService.getMovers();
  }

  async getTrending() {
    return marketDataService.getTrending();
  }

  async getDashboardOverview() {
    // This aggregates multiple data points for the dashboard
    // Note: Portfolio and buying power would be fetched from portfolioService via controller or here
    // We'll leave placeholders for portfolio data
    const movers = await this.getMovers();
    const marketOverview = await marketDataService.getQuote('SPY'); // Proxy for market overview
    
    // Attempt to get regime from python ML service if available
    let marketRegime = 'Unknown';
    try {
      const mlResponse = await axios.get(`${config.pythonServiceUrl}/api/ml/regime`);
      marketRegime = mlResponse.data.regime;
    } catch (e) {
      // Fallback
      marketRegime = 'Bullish';
    }

    return {
      marketRegime,
      marketOverview: marketOverview?.data || {},
      topGainers: (Array.isArray(movers?.data) ? movers?.data : movers?.data?.gainers)?.slice(0, 5) || [],
      topLosers: (Array.isArray(movers?.data) ? movers?.data : movers?.data?.losers)?.slice(-5) || [],
      // Other fields will be merged in controller
    };
  }

  async getSeasonality(symbol, period) {
    try {
      if (period !== 'monthly' && period !== 'weekly') {
        const error = new Error("Period must be 'monthly' or 'weekly'");
        error.status = 400;
        throw error;
      }
      
      const range = '10Y';
      const response = await marketDataService.getHistoricalData(symbol, range, '1d');
      const data = response?.data;
      
      if (!data || data.length === 0) {
        throw new Error('Seasonality data unavailable');
      }

      const results = [];

      if (period === 'monthly') {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlyData = {};
        
        data.forEach(candle => {
          const d = new Date(candle.date);
          const year = d.getFullYear();
          const month = d.getMonth();
          const key = `${year}-${month}`;
          
          if (!monthlyData[key]) monthlyData[key] = [];
          monthlyData[key].push(candle);
        });

        const monthlyReturns = Array.from({ length: 12 }, () => []);
        
        for (const key in monthlyData) {
          const monthCandles = monthlyData[key].sort((a, b) => new Date(a.date) - new Date(b.date));
          const first = monthCandles[0];
          const last = monthCandles[monthCandles.length - 1];
          
          if (first.open) {
             const ret = ((last.close - first.open) / first.open) * 100;
             const month = new Date(first.date).getMonth();
             monthlyReturns[month].push(ret);
          }
        }
        
        for (let i = 0; i < 12; i++) {
          const returns = monthlyReturns[i];
          const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
          results.push({
            month: monthNames[i],
            avgReturn: Number(avgReturn.toFixed(2))
          });
        }
      } else if (period === 'weekly') {
        const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
        const dailyReturns = Array.from({ length: 5 }, () => []);
        
        for (let i = 1; i < data.length; i++) {
          const current = data[i];
          const previous = data[i - 1];
          const date = new Date(current.date);
          const day = date.getDay();
          
          if (day >= 1 && day <= 5) {
            if (previous.close) {
              const ret = ((current.close - previous.close) / previous.close) * 100;
              dailyReturns[day - 1].push(ret);
            }
          }
        }
        
        for (let i = 0; i < 5; i++) {
          const returns = dailyReturns[i];
          const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
          results.push({
            day: dayNames[i],
            avgReturn: Number(avgReturn.toFixed(2))
          });
        }
      }

      return { 
        data: {
          symbol,
          period,
          data: results
        }, 
        source: 'node_service', 
        cached: false 
      };
    } catch (e) {
      const error = new Error(`Seasonality calculation failed: ${e.message}`);
      if (e.status) error.status = e.status;
      throw error;
    }
  }
}

export default new MarketFacadeService();
