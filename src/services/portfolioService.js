import Holding from "../models/holding.model.js";
import Transaction from "../models/transaction.model.js";
import Watchlist from "../models/watchlist.model.js";
import * as twelveDataService from "./twelveDataService.js";

/**
 * Get user's entire portfolio view
 * @param {string} userId 
 */
export async function getUserPortfolio(userId) {
  const holdings = await Holding.find({ user: userId });
  const recentTransactions = await Transaction.find({ user: userId })
    .sort({ date: -1 })
    .limit(10);
  const watchlist = await Watchlist.find({ user: userId });

  // Calculate current portfolio value and daily gain
  const calculatedPortfolio = await calculatePortfolioMetrics(holdings);

  return {
    summary: calculatedPortfolio,
    holdings,
    transactions: recentTransactions,
    watchlist
  };
}

/**
 * Fetch User Holdings
 */
export async function getHoldings(userId) {
  return await Holding.find({ user: userId });
}

/**
 * Fetch User Watchlist
 */
export async function getWatchlist(userId) {
  return await Watchlist.find({ user: userId }).sort({ addedAt: -1 });
}

/**
 * Fetch User Transactions with optional limit
 */
export async function getTransactions(userId, limit = 0) {
  let query = Transaction.find({ user: userId }).sort({ date: -1 });
  
  if (limit > 0) {
    query = query.limit(limit);
  }
  
  return await query;
}

/**
 * Toggle Watchlist item
 */
export async function toggleWatchlist(userId, symbol) {
  const existing = await Watchlist.findOne({ user: userId, symbol });

  if (existing) {
    await Watchlist.deleteOne({ _id: existing._id });
    return { inWatchlist: false };
  } else {
    await Watchlist.create({ user: userId, symbol });
    return { inWatchlist: true };
  }
}


/**
 * Helper to calculate total value and gain
 * This fetches current price for each holding
 */
async function calculatePortfolioMetrics(holdings) {
  let totalValue = 0;
  let totalCost = 0;
  let todaysGain = 0; // Simplified: Current Value - Cost Basis (Realized + Unrealized would be better but keeping simple)
  
  // Note: For a real app, we'd batch fetch prices. 
  // Here we'll iterate (could be slow if many holdings, but fine for MVP)
  
  const holdingDetails = await Promise.all(holdings.map(async (h) => {
    let currentPrice = h.avgCost; // Default to cost if fetch fails
    try {
      // Use getQuote from twelveDataService (which now uses FMP as per previous migration)
      const quote = await twelveDataService.getQuote(h.symbol);
      if (quote && quote.price) {
        currentPrice = quote.price;
      }
    } catch (err) {
      console.error(`Failed to fetch price for ${h.symbol}`, err.message);
    }

    const value = h.quantity * currentPrice;
    const cost = h.quantity * h.avgCost;
    
    totalValue += value;
    totalCost += cost;

    return {
      symbol: h.symbol,
      quantity: h.quantity,
      avgCost: h.avgCost,
      currentPrice,
      currentValue: value,
      gain: value - cost,
      gainPercent: cost > 0 ? ((value - cost) / cost) * 100 : 0
    };
  }));

  return {
    totalValue,
    totalCost,
    totalGain: totalValue - totalCost,
    totalGainPercent: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
    details: holdingDetails
  };
}
