import marketService from './market.service.js';
import * as portfolioService from '../../services/portfolioService.js';
import * as snapshotService from '../../services/snapshotService.js';
import marketStreamService from './MarketStreamService.js';

export async function getQuote(req, res, next) {
  try {
    const { symbol } = req.params;
    const result = await marketService.getQuote(symbol);
    res.json({ success: true, ...result, error: null });
  } catch (error) {
    next(error);
  }
}

export async function getHistoricalData(req, res, next) {
  try {
    const { symbol } = req.params;
    let { range, interval } = req.query;
    
    // Cap maximum data load to 10 years instead of 5 years
    if (range && range.toUpperCase() === 'MAX') {
      range = '10Y';
    }
    
    const result = await marketService.getHistoricalData(symbol, range, interval);
    res.json({ success: true, ...result, error: null });
  } catch (error) {
    next(error);
  }
}

export async function searchSymbol(req, res, next) {
  try {
    const { q } = req.query;
    const result = await marketService.searchSymbol(q);
    res.json({ success: true, ...result, error: null });
  } catch (error) {
    next(error);
  }
}

export async function getMovers(req, res, next) {
  try {
    const result = await marketService.getMovers();
    res.json({ success: true, ...result, error: null });
  } catch (error) {
    next(error);
  }
}

export async function getTrending(req, res, next) {
  try {
    const result = await marketService.getTrending();
    // Wrap the response in the two-stage partial format
    let symbols = [];
    let quotes = [];
    if (result && result.data) {
        symbols = result.data.map(item => item.symbol || item);
        quotes = result.data;
    }
    res.json({ 
      success: true, 
      data: {
        symbols: symbols,
        quotes: quotes,
        status: "partial"
      }, 
      error: null 
    });
  } catch (error) {
    next(error);
  }
}

export async function getSeasonality(req, res, next) {
  try {
    const { symbol } = req.params;
    const { period } = req.query;
    const result = await marketService.getSeasonality(symbol, period);
    res.json({ success: true, ...result, error: null });
  } catch (error) {
    next(error);
  }
}

export async function streamMarketData(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  marketStreamService.addClient(res);

  const symbolsStr = req.query.symbols || '';
  const symbols = symbolsStr.split(',').filter(Boolean);
  
  for (const symbol of symbols) {
    marketStreamService.subscribe(symbol);
  }

  req.on('close', () => {
    for (const symbol of symbols) {
      marketStreamService.unsubscribe(symbol);
    }
  });
}

import marketStructureService from './marketStructure.service.js';

export async function getMarketStructure(req, res, next) {
  try {
    const result = await marketStructureService.getMarketStructure();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}


// DASHBOARD OVERVIEW
export async function getDashboardOverview(req, res, next) {
  try {
    // 1. Fetch Market Data Aggregates
    const marketData = await marketService.getDashboardOverview();

    // 2. Fetch User Portfolio Data
    // Mock user id if not auth'd for now, or assume auth middleware sets req.user
    const userId = req.user?.id || 1; 
    let portfolio = { summary: { balance: 0, equity: 0 } };
    let dayPnL = 0;
    let holdings = [];

    try {
      portfolio = await portfolioService.getUserPortfolio(userId);
      dayPnL = await snapshotService.getDayPnl(userId, portfolio.summary.equity);
      holdings = await portfolioService.getHoldings(userId);
    } catch (e) {
      console.warn("Could not fetch portfolio for dashboard", e.message);
    }

    const payload = {
      success: true,
      data: {
        portfolio: portfolio.summary,
        buyingPower: portfolio.summary.balance,
        dayPnL,
        activePositions: holdings.length,
        dayExposure: portfolio.summary.equity, // Simplified
        winRate: 0.65, // Placeholder
        marketRegime: marketData.marketRegime,
        marketOverview: marketData.marketOverview,
        chart: [], // Placeholder for equity curve
        marketBreadth: { advancers: 300, decliners: 200, unchanged: 50 }, // Placeholder
        sectorPerformance: [], // Placeholder
        topGainers: marketData.topGainers,
        topLosers: marketData.topLosers
      },
      error: null
    };

    res.json(payload);
  } catch (error) {
    next(error);
  }
}
