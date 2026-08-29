import forecastService from "./forecast.service.js";

export async function getForecast(req, res, next) {
  try {
    const { symbol } = req.params;
    const result = await forecastService.getForecastForSymbol(symbol);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
