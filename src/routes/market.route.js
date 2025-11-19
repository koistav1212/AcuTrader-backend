import { Router } from "express";
import { search, quote, weeklyMostTraded } from "../controllers/marketController.js";
import { auth } from "../middleware/auth.js";

const router = Router();

/**
 * @openapi
 * /api/market/search:
 *   get:
 *     tags: [Market]
 *     summary: Search stocks by symbol or company name
 *     parameters:
 *       - name: query
 *         in: query
 *         description: Symbol or company name
 *         required: true
 *         schema:
 *           type: string
 *           example: AAPL
 *     responses:
 *       200:
 *         description: List of stocks matching query
 */

/**
 * @openapi
 * /api/market/quote/{symbol}:
 *   get:
 *     tags: [Market]
 *     summary: Get live quote for a stock
 *     parameters:
 *       - name: symbol
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           example: TSLA
 *     responses:
 *       200:
 *         description: Single stock quote returned
 */

/**
 * @openapi
 * /api/market/weekly-most-traded:
 *   get:
 *     tags: [Market]
 *     summary: Get highest-volume stocks for the week
 *     responses:
 *       200:
 *         description: Weekly high-volume stock list
 */

// Search stock
router.get("/search", auth(false), search);

// Get quote for one stock
router.get("/quote/:symbol", auth(false), quote);

// Highest traded stocks of the week
router.get("/weekly-most-traded", auth(false), weeklyMostTraded);

export default router;
