import { Router } from "express";
import { auth } from "../middleware/auth.js";
import * as legacyMarketController from "../controllers/marketController.js";
import newMarketRoutes from "../modules/market/market.routes.js";

const router = Router();

// --- PORTFOLIO & TRADING (Authenticated) ---
router.get("/portfolio/summary", auth(true), legacyMarketController.getPortfolioSummary);
router.get("/portfolio/positions", auth(true), legacyMarketController.getPositions);
router.get("/portfolio/trades", auth(true), legacyMarketController.getTrades);

router.post("/trade", auth(true), legacyMarketController.placeTrade); // Unified
router.post("/snapshot", auth(true), legacyMarketController.triggerSnapshot); // Manual trigger

// Legacy Buy/Sell Adapters
router.post("/buy", auth(true), legacyMarketController.buyStock);
router.post("/sell", auth(true), legacyMarketController.sellStock);

// --- NEW MARKET DATA (Delegated to modular router) ---
router.use("/", newMarketRoutes);

export default router;
