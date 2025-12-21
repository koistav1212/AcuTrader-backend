import Transaction from "../models/transaction.model.js";
import Holding from "../models/holding.model.js";

/**
 * Buy stock for a user
 * @param {string} userId - User ID
 * @param {string} symbol - Stock symbol
 * @param {number} quantity - Quantity to buy
 * @param {number} price - Price per share
 */
export async function buyStock(userId, symbol, quantity, price) {
  const totalCost = quantity * price;

  // 1. Create Transaction Record
  const transaction = await Transaction.create({
    user: userId,
    symbol,
    type: "BUY",
    quantity,
    price,
    totalCost
  });

  // 2. Update or Create Holding
  let holding = await Holding.findOne({ user: userId, symbol });

  if (holding) {
    // Recalculate Average Cost: (Total Current Cost + New Purchase Cost) / Total Quantity
    const currentTotalCost = holding.quantity * holding.avgCost;
    const newTotalCost = currentTotalCost + totalCost;
    const newQuantity = holding.quantity + quantity;
    
    holding.quantity = newQuantity;
    holding.avgCost = newTotalCost / newQuantity;
    await holding.save();
  } else {
    // Create new holding
    holding = await Holding.create({
      user: userId,
      symbol,
      quantity,
      avgCost: price
    });
  }

  return { transaction, holding };
}

/**
 * Sell stock for a user
 * @param {string} userId - User ID
 * @param {string} symbol - Stock symbol
 * @param {number} quantity - Quantity to sell
 * @param {number} price - Price per share
 */
export async function sellStock(userId, symbol, quantity, price) {
  const totalCost = quantity * price; // Total Sale Value

  // 1. Check if user has enough holdings
  const holding = await Holding.findOne({ user: userId, symbol });

  if (!holding || holding.quantity < quantity) {
    const error = new Error("Insufficient holdings to sell");
    error.status = 400;
    throw error;
  }

  // 2. Create Transaction Record
  const transaction = await Transaction.create({
    user: userId,
    symbol,
    type: "SELL",
    quantity,
    price,
    totalCost
  });

  // 3. Update Holding
  holding.quantity -= quantity;

  if (holding.quantity === 0) {
    await Holding.deleteOne({ _id: holding._id });
  } else {
    await holding.save();
  }

  return { transaction, remainingHolding: holding.quantity > 0 ? holding : null };
}
