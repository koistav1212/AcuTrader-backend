import researchService from "./research.service.js";

export async function getResearch(req, res, next) {
  try {
    const { symbol } = req.params;
    const result = await researchService.getResearchForSymbol(symbol);
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
    const results = await Promise.all(symbols.map(s => researchService.getResearchForSymbol(s)));
    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
}
