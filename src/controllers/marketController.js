import { searchSymbol, getQuote, getWeeklyMostTraded } from "../services/alphaVantageService.js";

export async function search(req, res, next) {
  try {
    const q = req.query.q || req.query.query;   // <-- FIX HERE

    if (!q) return res.status(400).json({ message: "q query required" });

    const results = await searchSymbol(q);
    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function quote(req, res, next) {
  try {
    const { symbol } = req.params;
    const data = await getQuote(symbol);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function weeklyMostTraded(req, res, next) {
  try {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ message: "symbol query required" });

    const data = await getWeeklyMostTraded(symbol);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
