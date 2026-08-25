import { Router } from 'express';
import * as marketController from './market.controller.js';
// Optional auth for market endpoints if needed
import { auth } from '../../middleware/auth.js';

const router = Router();

// Dashboard
router.get('/overview', auth(true), marketController.getDashboardOverview);

// Market Data
router.get('/quote/:symbol', marketController.getQuote);
router.get('/history/:symbol', marketController.getHistoricalData);
router.get('/search', marketController.searchSymbol);
router.get('/movers', marketController.getMovers);
router.get('/trending', marketController.getTrending);
router.get('/seasonality/:symbol', marketController.getSeasonality);
router.get('/structure', marketController.getMarketStructure);

// SSE Stream
router.get('/stream', marketController.streamMarketData);

export default router;
