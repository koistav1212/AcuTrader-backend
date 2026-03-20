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
router.get("/top-movers", auth(false), marketController.getTopMovers);


router.get("/historical-data", auth(false), marketController.getHistoricalData);

export default router;
