import fs from 'fs/promises';
import path from 'path';

const FORECAST_DIR = path.join(process.cwd(), 'data', 'forecasts');

export async function getForecast(req, res, next) {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ success: false, message: "Symbol is required" });
    }

    const latestFilePath = path.join(FORECAST_DIR, symbol.toUpperCase(), 'latest.json');

    try {
      const dataStr = await fs.readFile(latestFilePath, 'utf-8');
      const data = JSON.parse(dataStr);
      return res.json(data); // `data` itself is the full JSON object including {success: true, ...}
    } catch (err) {
      return res.status(200).json({
        success: false,
        status: "forecast_unavailable",
        symbol: symbol.toUpperCase(),
        message: "No validated forecast is currently available."
      });
    }

  } catch (error) {
    next(error);
  }
}
