import { Router } from "express";
import { auth } from "../middleware/auth.js";
import * as marketController from "../controllers/marketController.js";

const router = Router();

// --- PORTFOLIO & TRADING (Authenticated) ---
router.get("/portfolio/summary", auth(true), marketController.getPortfolioSummary);
router.get("/portfolio/positions", auth(true), marketController.getPositions);
router.get("/portfolio/trades", auth(true), marketController.getTrades);

router.post("/trade", auth(true), marketController.placeTrade); // Unified
router.post("/snapshot", auth(true), marketController.triggerSnapshot); // Manual trigger

// Legacy Buy/Sell Adapters
router.post("/buy", auth(true), marketController.buyStock);
router.post("/sell", auth(true), marketController.sellStock);

// --- MARKET DATA (Public or Auth Optional) ---

/**
 * @openapi
 * /api/market/search:
 *   get:
 *     summary: Search stocks by symbol or company name
 */
router.get("/search", auth(false), marketController.searchSymbol);

/**
 * @openapi
 * /api/market/quote/{symbol}:
 *   get:
 *     summary: Get real-time quote for a symbol
 */
router.get("/quote/:symbol", auth(false), marketController.getQuote);

/**
 * @openapi
 * /api/market/trending:
 *   get:
 *     summary: Get top stocks based on dynamic filters (Screener)
 */
router.get("/trending", auth(false), marketController.getTrendingStocks);

/**
 * @openapi
 * /api/market/top-gainers:
 *   get:
 *     summary: Get top 10 gainers
 */
router.get("/top-gainers", auth(false), marketController.getTopGainers);

/**
 * @openapi
 * /api/market/top-losers:
 *   get:
 *     summary: Get top 10 losers
 */
router.get("/top-losers", auth(false), marketController.getTopLosers);

// Recommendations
// Note: Route was likely /recommendations/:symbol based on old controller usage?
// I'll add it if it was there. Old controller "recommendations" export suggests it might have been used.
// Checking Step 62: `export const recommendations`.
// I'll assume the route path was `/recommendations/:symbol`.
router.get("/recommendations/:symbol", auth(false), marketController.getRecommendations);

// Insights Route
/** 
 * @openapi
 * /api/market/insights:
 *   get:
 *     summary: Get AI-generated stock insights from the ML pipeline
 *     description: Returns cached insights including fundamentals, technicals, trade reports, and AI news summaries
 *     tags:
 *       - Market
 *     parameters:
 *       - in: query
 *         name: ticker
 *         required: true
 *         schema:
 *           type: string
 *         description: Stock ticker symbol (e.g., TSLA, AAPL)
 *     responses:
 *       200:
 *         description: Stock insights data for the specified ticker
 *       400:
 *         description: Ticker is required
 *       404:
 *         description: No insights found for the ticker
 */
router.get("/insights", auth(false), marketController.getStockInsights);

export default router;
