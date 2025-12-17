import {
  searchSymbol,
  getQuote,
  getStockPriceChange,
  getStockRecommendations
} from "../services/twelveDataService.js";

export const search = async (req, res, next) => {
  try {
    res.json(await searchSymbol(req.query.q));
  } catch (e) { next(e); }
};

export const quote = async (req, res, next) => {
  try {
    res.json(await getQuote(req.params.symbol));
  } catch (e) { next(e); }
};

export const priceChange = async (req, res, next) => {
  try {
    res.json(await getStockPriceChange(req.params.symbol));
  } catch (e) { next(e); }
};

export const recommendations = async (req, res, next) => {
  try {
    res.json(await getStockRecommendations(req.params.symbol));
  } catch (e) { next(e); }
};
