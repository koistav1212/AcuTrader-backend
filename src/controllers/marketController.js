import { searchSymbol, getQuote, getWeeklyMostTraded } from "../services/twelveDataService.js";

export async function search(req, res, next) {
  try {
    const q = req.query.q || req.query.query;
    if (!q) return res.status(400).json({ message: "q query required" });

    const result = await searchSymbol(q);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function quote(req, res, next) {
  try {
    const symbol = req.params.symbol;
    const result = await getQuote(symbol);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function weeklyMostTraded(req, res, next) {
  try {
    const symbol = req.query.symbol || "AAPL";
    const data = await getWeeklyMostTraded(symbol);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
