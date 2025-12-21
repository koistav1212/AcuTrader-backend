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
    enum: ["BUY", "SELL"],
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
}, { timestamps: true });

export default mongoose.model("Transaction", transactionSchema);
