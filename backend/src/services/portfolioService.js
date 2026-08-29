import Holding from "../models/holding.model.js";
import Transaction from "../models/transaction.model.js";
import Watchlist from "../models/watchlist.model.js";
import User from "../models/user.model.js";
import * as twelveDataService from "./twelveDataService.js";
import { calculateEquity, calculatePositionPnl } from "../utils/portfolioLogic.js";

/**
 * Get user's entire portfolio view
 * Returns: { summary, holdings, transactions, watchlist }
 * Summary includes: balance, equity, unrealizedPnl, portfolioValue
 */
export async function getUserPortfolio(userId) {
  const user = await User.findById(userId);
  const holdings = await Holding.find({ user: userId });
  const recentTransactions = await Transaction.find({ user: userId })
    .sort({ date: -1 })
    .limit(10);
  const watchlist = await Watchlist.find({ user: userId });

  // Calculate live portfolio metrics
  const calculatedPortfolio = await calculatePortfolioMetrics(user, holdings);

  return {
    summary: calculatedPortfolio,
    holdings: calculatedPortfolio.details, // Enhanced holdings with P&L
    transactions: recentTransactions,
    watchlist
  };
}

export async function getHoldings(userId) {
  const holdings = await Holding.find({ user: userId });
  // We should ideally return enhanced holdings with P&L, but keeping simpler for raw calls
  // or we can reuse logic
  const user = await User.findById(userId); // Need balance? No, just positions
  // Let's do a quick fetch
  const { details } = await calculatePortfolioMetrics(user || {}, holdings);
  return details;
}

export async function getWatchlist(userId) {
  return await Watchlist.find({ user: userId }).sort({ addedAt: -1 });
}

export async function getTransactions(userId, limit = 0) {
  let query = Transaction.find({ user: userId }).sort({ date: -1 });
  if (limit > 0) query = query.limit(limit);
  return await query;
}

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
 * Helper to calculate total equity, balance, and position P&Ls
 */
async function calculatePortfolioMetrics(user, holdings) {
  const balance = user.accountBalance || 0;
  
  // 1. Prepare symbols for batch fetch
  const symbols = holdings.map(h => h.symbol);
  
  // 2. Batch Fetch Prices
  let priceMap = {};
  try {
    priceMap = await twelveDataService.getBatchQuotes(symbols);
  } catch (err) {
    console.error("Failed to batch fetch prices:", err.message);
  }

  // 3. Process Holdings
  const holdingDetails = holdings.map((h) => {
    // ROBUST PRICE LOGIC (User Provided Fix)
    const s = priceMap[h.symbol] || {};
    
    const parse = (v) => {
        const n = Number(v);
        return isNaN(n) ? null : n;
    };

    const safeMid = (bid, ask) => {
      const b = parse(bid);
      const a = parse(ask);
      return (b && a) ? (b + a) / 2 : null;
    };

    const prevClose = parse(s.previous_close) || parse(h.avgCost);

    // Explicit Priority: Last > Mid > Current > Price > PrevClose
    const rawPrice =
      parse(s.last_price) ??
      safeMid(s.bid, s.ask) ??
      parse(s.current_price) ??
      parse(s.price) ??
      prevClose;

    let currentPrice = (rawPrice > 0) ? rawPrice : prevClose;

    // SANITY CHECK: If price is unrealistically high (e.g. > 5000 for standard stocks) or matches known bad data patterns
    // User specifically mentioned 6902 vs 447 for TSLA.
    // We'll use a threshold or relative check.
    // Relative: If price > 3x AvgCost (and AvgCost > 0) -> Suspect?
    // Hard check as requested:
    if (currentPrice > 5000 && (!h.avgCost || h.avgCost < 1000)) {
       // console.warn(`Sanity Check Failed for ${h.symbol}: Price ${currentPrice} seems wrong vs AvgCost ${h.avgCost}. Using PrevClose.`);
       currentPrice = prevClose || h.avgCost;
    }
    
    // Fallback if still invalid
    if (!currentPrice || currentPrice <= 0) currentPrice = h.avgCost;

    const marketValue = h.quantity * currentPrice;
    const unrealizedPnl = calculatePositionPnl(h, currentPrice);
    
    // Return Percent: (Unrealized / CostBasis) * 100
    // CostBasis = Qty * AvgEntry
    const costBasis = h.quantity * h.avgCost;
    
    return {
      symbol: h.symbol,
      side: h.side,
      quantity: h.quantity,
      avgCost: h.avgCost,
      currentPrice,
      marketValue,
      unrealizedPnl,
      returnPercent: costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0
    };
  });

  // 4. Aggregate
  const totalUnrealizedPnl = holdingDetails.reduce((sum, h) => sum + h.unrealizedPnl, 0);
  const equity = calculateEquity(balance, totalUnrealizedPnl);

  return {
    balance,
    equity,
    totalUnrealizedPnl,
    details: holdingDetails
  };
}
