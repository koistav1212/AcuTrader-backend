import mongoose from "mongoose";

const analysisRunSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true },
    analysis_date: { type: Date, required: true },
    pipeline_version: { type: String, required: true },
    status: { 
      type: String, 
      enum: ["QUEUED", "RUNNING", "SUCCESS", "PARTIAL", "INSUFFICIENT_DATA", "FAILED"], 
      default: "QUEUED" 
    },
    started_at: { type: Date },
    completed_at: { type: Date },
    error: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

analysisRunSchema.index({ symbol: 1, analysis_date: 1, pipeline_version: 1 }, { unique: true });

export default mongoose.models.AnalysisRun || mongoose.model("AnalysisRun", analysisRunSchema);
