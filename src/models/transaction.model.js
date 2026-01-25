import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  symbol: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["BUY", "SELL", "SHORT", "COVER"],
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0,
  },
  status: {
    type: String,
    default: "COMPLETED",
  },
  date: {
    type: Date,
    default: Date.now,
  },
  entryPrice: { // For Exit trades: The avg cost of the position being closed
    type: Number,
  },
  realizedPnl: { // For Exit trades: The P&L realized
    type: Number,
  },
}, { timestamps: true });

export default mongoose.model("Transaction", transactionSchema);
