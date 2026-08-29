/**
 * AcuTrader Core Financial Logic
 * Standardized formulas for Portfolio and P&L calculations.
 */

/**
 * Calculate Account Equity
 * Equity = Cash Balance + Unrealized P&L
 * @param {number} balance - Current cash balance
 * @param {number} unrealizedPnl - Total unrealized P&L from all open positions
 * @returns {number}
 */
export const calculateEquity = (balance, unrealizedPnl) => {
  return balance + unrealizedPnl;
};

/**
 * Calculate Unrealized P&L for a SINGLE position
 * Long: (Current Price - Avg Entry) * Quantity
 * Short: (Avg Entry - Current Price) * Quantity
 * @param {object} position - { side: 'LONG'|'SHORT', avgCost: number, quantity: number }
 * @param {number} currentPrice - Live market price
 * @returns {number}
 */
export const calculatePositionPnl = (position, currentPrice) => {
  const { side, avgCost, quantity } = position;
  if (side === "SHORT") {
    return (avgCost - currentPrice) * quantity;
  }
  // Default to LONG
  return (currentPrice - avgCost) * quantity;
};

/**
 * Calculate New Average Price for Averaging Down/Up (Weighted Average)
 * Formula: ((Old Qty * Old Avg) + (New Qty * New Price)) / Total Qty
 * @param {number} currentQty
 * @param {number} currentAvg
 * @param {number} newQty
 * @param {number} newPrice
 * @returns {number}
 */
export const calculateNewAveragePrice = (currentQty, currentAvg, newQty, newPrice) => {
  const totalQty = currentQty + newQty;
  if (totalQty === 0) return 0;
  return ((currentQty * currentAvg) + (newQty * newPrice)) / totalQty;
};

/**
 * Calculate Realized P&L on Exit
 * Long Exit: (Exit Price - Entry Price) * Qty
 * Short Exit: (Entry Price - Exit Price) * Qty
 * @param {string} side - 'LONG' or 'SHORT' (The side being CLOSED)
 * @param {number} entryPrice - Average entry price
 * @param {number} exitPrice - Execution price of the exit trade
 * @param {number} qty - Quantity being closed
 * @returns {number}
 */
export const calculateRealizedPnl = (side, entryPrice, exitPrice, qty) => {
  if (side === "SHORT") {
    return (entryPrice - exitPrice) * qty;
  }
  return (exitPrice - entryPrice) * qty;
};
