import fs from 'fs/promises';
import path from 'path';
import AnalysisResult from "../../models/analysisResult.model.js";

const FORECAST_DIR = path.join(process.cwd(), 'data', 'forecasts');

export async function getResearch(req, res, next) {
  try {
    const { symbol } = req.params;
    if (!symbol) return res.status(400).json({ success: false, message: "Symbol is required" });
    
    const latestFilePath = path.join(FORECAST_DIR, symbol.toUpperCase(), 'latest.json');
    try {
      const dataStr = await fs.readFile(latestFilePath, 'utf-8');
      const data = JSON.parse(dataStr);
      return res.json(data);
    } catch (err) {
      return res.status(200).json({ 
        success: false, 
        status: "not_ready",
        message: "No daily forecast available for this symbol. The nightly pipeline has not processed it yet." 
      });
    }
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
    const results = [];

    for (const symbol of uppercaseSymbols) {
      const latestFilePath = path.join(FORECAST_DIR, symbol, 'latest.json');
      try {
        const dataStr = await fs.readFile(latestFilePath, 'utf-8');
        const data = JSON.parse(dataStr);
        results.push(data);
      } catch (err) {
        // Skip missing forecasts
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
}
