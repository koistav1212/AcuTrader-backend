import mongoose from "mongoose";

const holdingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  symbol: {
    type: String,
    required: true,
  },
  side: {
    type: String,
    enum: ["LONG", "SHORT"],
    default: "LONG",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  avgCost: {
    type: Number,
    required: true,
    min: 0,
  },
}, { timestamps: true });

// Compound index to ensure a user only has one holding entry per symbol
holdingSchema.index({ user: 1, symbol: 1 }, { unique: true });

export default mongoose.model("Holding", holdingSchema);
