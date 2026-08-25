import newsService from "./news.service.js";

export async function getNews(req, res, next) {
  try {
    const { symbol } = req.params;
    const days = parseInt(req.query.days) || 30;
    const result = await newsService.getNewsForSymbol(symbol, days);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
