import mongoose from "mongoose";

const analysisResultSchema = new mongoose.Schema(
  {
    analysis_run_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AnalysisRun', required: true },
    symbol: { type: String, required: true },
    analysis_date: { type: Date, required: true },
    
    market_context: { type: mongoose.Schema.Types.Mixed },
    technical_context: { type: mongoose.Schema.Types.Mixed },
    fundamental_context: { type: mongoose.Schema.Types.Mixed },
    news_context: { type: mongoose.Schema.Types.Mixed },
    model_outputs: { type: mongoose.Schema.Types.Mixed },
    forecast: { type: mongoose.Schema.Types.Mixed },
    llm_context: { type: mongoose.Schema.Types.Mixed },
    llm_output: { type: mongoose.Schema.Types.Mixed },
    data_quality: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

analysisResultSchema.index({ symbol: 1, analysis_date: 1 }, { unique: true });

export default mongoose.models.AnalysisResult || mongoose.model("AnalysisResult", analysisResultSchema);
