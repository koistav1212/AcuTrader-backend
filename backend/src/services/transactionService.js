import Transaction from "../models/transaction.model.js";
import Holding from "../models/holding.model.js";
import User from "../models/user.model.js";
import { calculateNewAveragePrice, calculateRealizedPnl } from "../utils/portfolioLogic.js";

/**
 * Execute a trade (BUY, SELL, SHORT, COVER)
 * Handles Position updates, Balance updates, and Transaction logging.
 * @param {string} userId
 * @param {string} symbol
 * @param {string} side - 'BUY' | 'SELL' | 'SHORT' | 'COVER'
 * @param {number} quantity
 * @param {number} price
 */
export async function executeTrade(userId, symbol, side, quantity, price) {
  const totalValue = quantity * price;
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  // Validate sufficient funds for opening positions (BUY or SHORT)
  // Note: For SHORT, we usually need margin, but for simplicity here we assume 1:1 margin requirement from cash
  if (side === "BUY" || side === "SHORT") {
    if (user.accountBalance < totalValue) {
      const error = new Error("Insufficient funds");
      error.status = 400;
      throw error;
    }
  }

  let position = await Holding.findOne({ user: userId, symbol });

  // --- LOGIC GATE ---

  // 1. BUY (Long Entry)
  if (side === "BUY") {
    if (position && position.side === "SHORT") {
      throw new Error("Cannot BUY while holding SHORT position. Use COVER to close short first.");
    }
    
    if (position) {
      // Averaging Entry
      position.avgCost = calculateNewAveragePrice(position.quantity, position.avgCost, quantity, price);
      position.quantity += quantity;
    } else {
      // New Position
      position = new Holding({
        user: userId,
        symbol,
        quantity,
        avgCost: price,
        side: "LONG"
      });
    }
    
    // Deduct Balance
    user.accountBalance -= totalValue;
  }

  // 2. SELL (Long Exit)
  else if (side === "SELL") {
    if (!position || position.side !== "LONG") {
      throw new Error("No Long position to SELL.");
    }
    if (position.quantity < quantity) {
      throw new Error("Insufficient Long quantity to SELL.");
    }

    // Realize P&L
    const realizePnl = calculateRealizedPnl("LONG", position.avgCost, price, quantity);
    
    // Update Position
    position.quantity -= quantity;
    
    // Credit Balance (Principal + P&L)
    // Actually simpler: Credit the full sale proceeds to balance.
    // Logic: You paid Cost. Now you get Value. Difference is P&L.
    // So Balance += TotalValue.
    user.accountBalance += totalValue;
  }

  // 3. SHORT (Short Entry)
  else if (side === "SHORT") {
    if (position && position.side === "LONG") {
      throw new Error("Cannot SHORT while holding LONG position. Use SELL to close long first.");
    }

    if (position) {
      // Averaging Short Entry (Sell Price is Entry Price for Short)
      position.avgCost = calculateNewAveragePrice(position.quantity, position.avgCost, quantity, price);
      position.quantity += quantity;
    } else {
      position = new Holding({
        user: userId,
        symbol,
        quantity,
        avgCost: price, // For Short, Entry Price is the Sell Price
        side: "SHORT"
      });
    }

    // Deduct Margin/Collateral (Assuming 100% Cash Secured for simplicity MVP)
    // In real shorting, you get cash but it's frozen. Here we'll deduct "Buying Power"
    user.accountBalance -= totalValue;
  }

  // 4. COVER (Short Exit)
  else if (side === "COVER") {
    if (!position || position.side !== "SHORT") {
      throw new Error("No Short position to COVER.");
    }
    if (position.quantity < quantity) {
      throw new Error("Insufficient Short quantity to COVER.");
    }

    // Realize P&L
    // Short P&L = (Entry - Exit) * Qty
    // Logic: We "locked" avgCost * Qty cash. Now we buy back at price * Qty.
    // The difference is return.
    // Simpler: We deducted TotalValue(Entry) when Shorting.
    // Now we "Release" that margin + P&L.
    // Wait, simpler generic ledger:
    // Cash = Cash - Cost_to_Cover + (Profit from Short)
    // No, let's stick to: Balance increased by (Entry_Value - Cost_to_Cover)? No.
    // Let's assume we deducted the FULL 'Notional Value' from Balance when opening Short.
    // So now we return the `Entry_Notional` + `PnL`?
    // Entry_Notional = Qty * AvgCost.
    // Cost_to_Cover = Qty * Price.
    // PnL = Entry_Notional - Cost_to_Cover.
    // So we return `Entry_Notional + PnL`? No, that's Entry + Entry - Cover = 2*Entry - Cover. Wrong.
    // We expect: NewBalance = OldBalance + (Entry_Value_Locked_Initial) + (Entry - Exit)?? 
    // Let's stick to the flow:
    // OPEN SHORT: Balance -= (Price * Qty). (We lock the cash size of the short).
    // CLOSE SHORT: We get back the Locked Cash + P&L.
    // Locked Cash portion for this chunk = Qty * AvgCost.
    // P&L = (AvgCost - Price) * Qty.
    // Total Return to Balance = (Qty * AvgCost) + (AvgCost - Price) * Qty ??
    // Returns = Qty*AvgCost + Qty*AvgCost - Qty*Price = 2*Entry - Exit. 
    // This implies we are betting the full value?
    // Standard Cash Account Shorting Logic (Paper Trading):
    // Shorting usually credited cash, but held as margin.
    // Let's treat "Balance" as "Buying Power".
    // Open Short: Buying Power reduces by notional value.
    // Close Short: Buying Power increases by notional value + P&L.
    // Credit to Balance = (Qty * AvgCost) + ((AvgCost - Price) * Qty) 
    // = Qty * AvgCost + Qty * AvgCost - Qty * Price
    // This seems to double count?
    // Let's look at P&L only.
    // You sold for X (Cached in margin). You buy for Y.
    // You keep X - Y.
    // If we deducted X from balance initially...
    // We should give back X + (X-Y) = 2X - Y.
    // Example: Short 1 share @ $100. Balance $1000 -> $900.
    // Cover 1 share @ $90. Profit $10.
    // Balance should be $1010.
    // Return = $110.
    // Formula: (Qty * AvgCost) + (Qty * (AvgCost - Price))
    // = Qty * (AvgCost + AvgCost - Price) 
    // = Qty * (2*AvgCost - Price).
    
    // Correct.
    const principalLocked = quantity * position.avgCost;
    const pnl = calculateRealizedPnl("SHORT", position.avgCost, price, quantity);
    user.accountBalance += (principalLocked + pnl);

    position.quantity -= quantity;
  }

  // --- SAVE UPDATES ---
  await user.save();
  
  if (position.quantity === 0) {
    await Holding.deleteOne({ _id: position._id });
  } else {
    await position.save();
  }

  // Create Transaction
  const transaction = await Transaction.create({
    user: userId,
    symbol,
    type: side,
    quantity,
    price,
    totalCost: totalValue,
    // Store P&L info for exits
    entryPrice: (side === "SELL" || side === "COVER") ? position.avgCost : undefined,
    realizedPnl: (side === "SELL" || side === "COVER") ? 
        calculateRealizedPnl(side === "SELL" ? "LONG" : "SHORT", position.avgCost, price, quantity) 
        : undefined
  });

  return { transaction, position: position.quantity > 0 ? position : null, newBalance: user.accountBalance };
}

// Adapters for legacy controller calls (if any) or simplified usage
export async function buyStock(userId, symbol, quantity, price) {
  return executeTrade(userId, symbol, "BUY", quantity, price);
}

export async function sellStock(userId, symbol, quantity, price) {
  return executeTrade(userId, symbol, "SELL", quantity, price);
}
