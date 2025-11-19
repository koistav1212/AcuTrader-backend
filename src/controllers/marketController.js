import {
  searchSymbol,
  getQuote,
  getWeeklyMostTraded,
  getTrendingStocks,
  getIntraday,
  getCryptoList,
  getCryptoDetails,
  getMutualFund
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

export const weeklyMostTraded = async (req, res, next) => {
  try {
    res.json(await getWeeklyMostTraded(req.query.symbol || "AAPL"));
  } catch (e) { next(e); }
};

export const trending = async (_, res, next) => {
  try {
    res.json(await getTrendingStocks());
  } catch (e) { next(e); }
};

export const intraday = async (req, res, next) => {
  try {
    res.json(await getIntraday(req.query.symbol, req.query.interval || "1min"));
  } catch (e) { next(e); }
};

/* ---------------- NEW ---------------- */
export const cryptoList = async (_, res, next) => {
  try {
    res.json(await getCryptoList());
  } catch (e) { next(e); }
};

export const cryptoDetails = async (req, res, next) => {
  try {
    res.json(await getCryptoDetails(req.params.symbol));
  } catch (e) { next(e); }
};

export const mutualFund = async (req, res, next) => {
  try {
    res.json(await getMutualFund(req.params.symbol));
  } catch (e) { next(e); }
};
