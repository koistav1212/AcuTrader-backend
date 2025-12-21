import {
  searchSymbol,
  getQuote,
  getStockPriceChange,
  getStockRecommendations,
  getTrendingStocks
} from "../services/twelveDataService.js";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
export const search = async (req, res, next) => {
  try {
    const result = await searchSymbol(req.query.q);
    if (!result || (Array.isArray(result) && result.length === 0) || (result.Stocks && result.Stocks.length === 0)) { 
        const error = new Error("No stocks found matching query");
        error.status = 404;
        throw error;
    }
    res.json(result);
  } catch (e) { next(e); }
};

export const quote = async (req, res, next) => {
  try {
    const result = await getQuote(req.params.symbol);
    if (!result) {
        const error = new Error(`Quote not found for symbol ${req.params.symbol}`);
        error.status = 404;
        throw error;
    }
    res.json(result);
  } catch (e) { next(e); }
};

export const priceChange = async (req, res, next) => {
  try {
    const result = await getStockPriceChange(req.params.symbol);
    if (!result) {
        const error = new Error(`Price data not found for symbol ${req.params.symbol}`);
        error.status = 404;
        throw error;
    }
    res.json(result);
  } catch (e) { next(e); }
};

export const recommendations = async (req, res, next) => {
  try {
    const result = await getStockRecommendations(req.params.symbol);
     if (!result || result.length === 0) {
        const error = new Error(`Recommendations not found for symbol ${req.params.symbol}`);
        error.status = 404;
        throw error;
    }
    res.json(result);
  } catch (e) { next(e); }
};

export const trending = async (req, res, next) => {
  try {
    // Pass request body as filters to the service
    const result = await getTrendingStocks(req.body);

    if (!result || result.length === 0) {
        const error = new Error("No trending stocks found with provided filters");
        error.status = 404;
        throw error;
    }
    res.json(result);
  } catch (e) { next(e); }
};
