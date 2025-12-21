import mongoose from "mongoose";

const watchlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  symbol: {
    type: String,
    required: true,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Compound index to ensure a symbol is only listed once per user
watchlistSchema.index({ user: 1, symbol: 1 }, { unique: true });

export default mongoose.model("Watchlist", watchlistSchema);
