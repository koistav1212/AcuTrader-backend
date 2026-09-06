import AnalysisResult from "../../models/analysisResult.model.js";

export async function getResearch(req, res, next) {
  try {
    const { symbol } = req.params;
    
    // Fetch latest analysis result for the symbol
    const result = await AnalysisResult.findOne({ symbol: symbol.toUpperCase() })
      .sort({ analysis_date: -1 })
      .lean();

    if (!result) {
      return res.status(200).json({ 
        success: false, 
        status: "not_ready",
        message: "No daily forecast available for this symbol. The nightly pipeline has not processed it yet." 
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getResearchBatch(req, res, next) {
  try {
    const { symbols } = req.body;
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ success: false, error: "Missing or invalid symbols array" });
    }
    
    const uppercaseSymbols = symbols.map(s => s.toUpperCase());
    
    // Fetch latest for each symbol.
    // A simple approach is to use aggregation to get the latest per symbol.
    const results = await AnalysisResult.aggregate([
      { $match: { symbol: { $in: uppercaseSymbols } } },
      { $sort: { analysis_date: -1 } },
      { $group: {
          _id: "$symbol",
          latestResult: { $first: "$$ROOT" }
      }},
      { $replaceRoot: { newRoot: "$latestResult" } }
    ]);

    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
}
