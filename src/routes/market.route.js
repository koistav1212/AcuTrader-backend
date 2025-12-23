// src/routes/market.route.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";

import {
  search,
  quote,
  priceChange,
  recommendations,
  trending,
  historical,
  topGainers,
  topLosers
} from "../controllers/marketController.js";

const router = Router();

/**
 * @openapi
 * /api/market/search:
 *   get:
 *     tags:
 *       - Market
 *     summary: Search stocks by symbol or company name
 *     parameters:
 *       - name: q
 *         in: query
 *         description: Stock symbol or company search text
 *         required: true
 *         schema:
 *           type: string
 *           example: AAPL
 *     responses:
 *       200:
 *         description: List of matched stock instruments
 */
router.get("/search", auth(false), search);

/**
 * @openapi
 * /api/market/quote/{symbol}:
 *   get:
 *     tags:
 *       - Market
 *     summary: Get real-time quote for a symbol
 *     parameters:
 *       - name: symbol
 *         in: path
 *         description: Stock symbol
 *         required: true
 *         schema:
 *           type: string
 *           example: TSLA
 *     responses:
 *       200:
 *         description: Real-time stock quote
 */
router.get("/quote/:symbol", auth(false), quote);

/**
 * @openapi
 * /api/market/price-change/{symbol}:
 *   get:
 *     tags:
 *       - Market
 *     summary: Get stock price change (1D, 5D, 1M, 3M, 6M, ytd, 1Y, 5Y, Max)
 *     parameters:
 *       - name: symbol
 *         in: path
 *         description: Stock symbol
 *         required: true
 *         schema:
 *           type: string
 *           example: AAPL
 *     responses:
 *       200:
 *         description: Stock price change data
 */
router.get("/price-change/:symbol", auth(false), priceChange);

/**
 * @openapi
 * /api/market/recommendations/{symbol}:
 *   get:
 *     tags:
 *       - Market
 *     summary: Get stock recommendation trends (Strong Buy, Buy, Hold, Sell, etc.)
 *     parameters:
 *       - name: symbol
 *         in: path
 *         description: Stock symbol
 *         required: true
 *         schema:
 *           type: string
 *           example: AAPL
 *     responses:
 *       200:
 *         description: Analyst recommendation trends
 */
router.get("/recommendations/:symbol", auth(false), recommendations);

/**
 * @openapi
 * /api/market/trending:
 *   get:
 *     tags:
 *       - Market
 *     summary: Get top stocks based on dynamic filters (Screener)
 *     responses:
 *       200:
 *         description: List of filtered stocks
 */
router.get("/trending", auth(false), trending);

/**
 * @openapi
 * /api/market/historical/{symbol}:
 *   get:
 *     tags:
 *       - Market
 *     summary: Get 1 year of historical data with technical indicators (Daily, Weekly, Monthly)
 *     parameters:
 *       - name: symbol
 *         in: path
 *         description: Stock symbol
 *         required: true
 *         schema:
 *           type: string
 *           example: AAPL
 *     responses:
 *       200:
 *         description: Historical data with indicators
 */
router.get("/historical/:symbol", auth(false), historical);

/**
 * @openapi
 * /api/market/top-gainers:
 *   get:
 *     tags:
 *       - Market
 *     summary: Get top 10 gainers with 1-month sparkline chart
 *     responses:
 *       200:
 *         description: List of top 10 gaining stocks
 */
router.get("/top-gainers", auth(false), topGainers);

/**
 * @openapi
 * /api/market/top-losers:
 *   get:
 *     tags:
 *       - Market
 *     summary: Get top 10 losers with 1-month sparkline chart
 *     responses:
 *       200:
 *         description: List of top 10 losing stocks
 */
router.get("/top-losers", auth(false), topLosers);

export default router;
