import mongoose from "mongoose";

const portfolioSnapshotSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  equity: {
    type: Number,
    required: true,
  },
  balance: {
    type: Number,
    required: true,
  },
  unrealizedPnl: {
    type: Number,
    default: 0,
  },
  realizedPnl: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

// Ensure one snapshot per user per day (conceptually), though date might include time. 
// We generally want to query by date range.
portfolioSnapshotSchema.index({ user: 1, date: -1 });

export default mongoose.model("PortfolioSnapshot", portfolioSnapshotSchema);
