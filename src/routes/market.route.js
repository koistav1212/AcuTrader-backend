// src/routes/market.route.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";

import {
  search,
  quote,
  weeklyMostTraded,
 //trending,
  intraday,
cryptoDetails,
cryptoList,
 // mutualFund
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
 * /api/market/weekly-most-traded:
 *   get:
 *     tags:
 *       - Market
 *     summary: Get highest traded volume days (past 30 days)
 *     parameters:
 *       - name: symbol
 *         in: query
 *         description: Stock symbol
 *         schema:
 *           type: string
 *           example: AAPL
 *     responses:
 *       200:
 *         description: Top 10 days with the highest volumes
 */
router.get("/weekly-most-traded", auth(false), weeklyMostTraded);

// /**
//  * @openapi
//  * /api/market/trending:
//  *   get:
//  *     tags:
//  *       - Market
//  *     summary: Get top trending stocks worldwide
//  *     responses:
//  *       200:
//  *         description: Trending stocks with metadata
//  */
// router.get("/trending", auth(false), trending);

/**
 * @openapi
 * /api/market/intraday:
 *   get:
 *     tags:
 *       - Market
 *     summary: Get intraday OHLC candles for a stock
 *     parameters:
 *       - name: symbol
 *         in: query
 *         description: Stock symbol
 *         schema:
 *           type: string
 *           example: AAPL
 *       - name: interval
 *         in: query
 *         description: Candle interval
 *         schema:
 *           type: string
 *           example: 1min
 *     responses:
 *       200:
 *         description: Intraday candle data
 */
router.get("/intraday", auth(false), intraday);

/**
 * @openapi
 * /api/market/crypto:
 *   get:
 *     tags: [Market]
 *     summary: Get crypto list
 *     responses:
 *       200:
 *         description: Crypto asset list
 */
router.get("/crypto", auth(false), cryptoList);

/**
 * @openapi
 * /api/market/crypto/{symbol}:
 *   get:
 *     tags: [Market]
 *     summary: Get crypto details with candles
 *     parameters:
 *       - name: symbol
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           example: BTC/USD
 *     responses:
 *       200:
 *         description: Crypto price + OHLC data
 */
router.get("/crypto/:symbol", auth(false), cryptoDetails);

/**
 * @openapi
 * /api/market/mutual/{symbol}:
 *   get:
 *     tags: [Market]
 *     summary: Get mutual fund details
 *     parameters:
 *       - name: symbol
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           example: 1535462D
 *     responses:
 *       200:
 *         description: Mutual fund data including NAV & returns
 */
 // router.get("/mutual/:symbol", auth(false), mutualFund);


export default router;
