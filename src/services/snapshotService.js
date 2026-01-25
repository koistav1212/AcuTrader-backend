import PortfolioSnapshot from "../models/portfolioSnapshot.model.js";
import User from "../models/user.model.js";
import { getUserPortfolio } from "./portfolioService.js";

/**
 * Take a daily snapshot for a specific user
 * Typically called at market close (3:30 PM) via cron
 */
export async function takeDailySnapshot(userId) {
  // 1. Get current portfolio state
  const portfolio = await getUserPortfolio(userId);
  const { equity, balance, totalUnrealizedPnl } = portfolio.summary;

  // 2. Normalize date to midnight (or specific close time)
  // For daily usage, we just want "today's Date"
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 3. Store Snapshot
  // Check if exists for today -> Update, else Create
  const snapshotData = {
    user: userId,
    date: today,
    equity,
    balance,
    unrealizedPnl: totalUnrealizedPnl,
    // Realized P&L? We need to track realized P&L for the day.
    // Ideally user model tracks "todaysRealizedPnl" which resets daily? 
    // Or we query transactions for today.
    realizedPnl: 0 // Placeholder: To compute this, we need to query transactions for today.
  };

  const snapshot = await PortfolioSnapshot.findOneAndUpdate(
    { user: userId, date: today },
    snapshotData,
    { upsert: true, new: true }
  );

  return snapshot;
}

/**
 * Get Historical Equity Curve
 */
export async function getEquityHistory(userId, days = 30) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return await PortfolioSnapshot.find({
    user: userId,
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: 1 });
}

/**
 * Calculate Day P&L
 * Day P&L = Current Equity - Previous Day Equity
 */
export async function getDayPnl(userId, currentEquity) {
  // Find most recent snapshot BEFORE today
  // Actually, if we just took a snapshot, it's today's close.
  // We want "Yesterday's Close".
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const previousSnapshot = await PortfolioSnapshot.findOne({
    user: userId,
    date: { $lt: today }
  }).sort({ date: -1 });

  if (!previousSnapshot) {
    // If no history, we cannot accurately calculate Day P&L purely from equity diff.
    // Comparing to Initial Capital is wrong if the user existed before but has no snapshots.
    // Safe Default: 0
    // Ideal: Sum of today's realized + today's unrealized change.
    return 0; 
  }

  return currentEquity - previousSnapshot.equity;
}
