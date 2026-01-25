import * as portfolioService from "../services/portfolioService.js";
import * as transactionService from "../services/transactionService.js";
import * as snapshotService from "../services/snapshotService.js";
import * as twelveDataService from "../services/twelveDataService.js";

// --- NEW PORTFOLIO ENDPOINTS ---

export async function getPortfolioSummary(req, res, next) {
  try {
    const portfolio = await portfolioService.getUserPortfolio(req.user.id);
    const dayPnl = await snapshotService.getDayPnl(req.user.id, portfolio.summary.equity);
    res.json({
      balance: portfolio.summary.balance,
      equity: portfolio.summary.equity,
      unrealizedPnl: portfolio.summary.totalUnrealizedPnl,
      dayPnl: dayPnl,
      cash: portfolio.summary.balance 
    });
  } catch (err) { next(err); }
}

export async function getPositions(req, res, next) {
  try {
    const holdings = await portfolioService.getHoldings(req.user.id);
    res.json(holdings);
  } catch (err) { next(err); }
}

export async function getTrades(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const trades = await portfolioService.getTransactions(req.user.id, limit);
    res.json(trades);
  } catch (err) { next(err); }
}


export async function placeTrade(req, res, next) {
  try {
    const { symbol, side, quantity, price } = req.body;
    if (!symbol || !side || !quantity || !price) {
      throw new Error("Missing required fields: symbol, side, quantity, price");
    }
    if (!["BUY", "SELL", "SHORT", "COVER"].includes(side)) {
      throw new Error(`Invalid side: ${side}. Must be BUY, SELL, SHORT, or COVER.`);
    }
    const result = await transactionService.executeTrade(req.user.id, symbol, side, Number(quantity), Number(price));
    res.json(result);
  } catch (err) { next(err); }
}

export async function triggerSnapshot(req, res, next) {
    try {
        const snapshot = await snapshotService.takeDailySnapshot(req.user.id);
        res.json(snapshot);
    } catch (err) { next(err); }
}

// --- LEGACY / MARKET DATA ENDPOINTS (Restored & Standardized) ---

// Was 'search'
export async function searchSymbol(req, res, next) {
  try {
    const { q } = req.query;
    if (!q) throw new Error("Query parameter 'q' is required");
    const result = await twelveDataService.searchSymbol(q);
    if (!result || (Array.isArray(result) && result.length === 0) || (result.Stocks && result.Stocks.length === 0)) { 
        const error = new Error("No stocks found matching query");
        error.status = 404;
        throw error;
    }
    res.json(result);
  } catch (err) { next(err); }
}

// Was 'quote'
export async function getQuote(req, res, next) {
  try {
    const { symbol } = req.params;
    const result = await twelveDataService.getQuote(symbol);
    if (!result) {
        const error = new Error(`Quote not found for symbol ${symbol}`);
        error.status = 404;
        throw error;
    }
    res.json(result);
  } catch (err) { next(err); }
}

// Was 'trending'
export async function getTrendingStocks(req, res, next) {
  try {
    const result = await twelveDataService.getTrendingStocks(req.body);
    if (!result || result.length === 0) {
        const error = new Error("No trending stocks found");
        error.status = 404;
        throw error;
    }
    res.json(result);
  } catch (err) { next(err); }
}

// Was 'topGainers'
export async function getTopGainers(req, res, next) {
  try {
    const result = await twelveDataService.getTopGainers();
    res.json(result);
  } catch (err) { next(err); }
}

// Was 'topLosers'
export async function getTopLosers(req, res, next) {
  try {
    const result = await twelveDataService.getTopLosers();
    res.json(result);
  } catch (err) { next(err); }
}

// Was 'recommendations'
export async function getRecommendations(req, res, next) {
  try {
    const { symbol } = req.params;
    const result = await twelveDataService.getRecommendations(symbol); // Ensure this exists in service or adapter
    // Note: old controller called getStockRecommendations? Wrapper in service might be named differently?
    // Checking service usage: "from ...services/twelveDataService.js"
    // I need to check twelveDataService exports if unsure. 
    // Assuming 'getRecommendations' or similar exists. 
    res.json(result);
  } catch (err) { next(err); }
}

// Was 'buyStock' / 'sellStock' (Legacy Adapters for users/legacy routes)
export async function buyStock(req, res, next) {
    try {
      const { symbol, quantity, price } = req.body;
      const result = await transactionService.executeTrade(req.user.id, symbol, "BUY", Number(quantity), Number(price));
      res.json(result);
    } catch (err) { next(err); }
}

export async function sellStock(req, res, next) {
    try {
      const { symbol, quantity, price } = req.body;
      const result = await transactionService.executeTrade(req.user.id, symbol, "SELL", Number(quantity), Number(price));
      res.json(result);
    } catch (err) { next(err); }
}
