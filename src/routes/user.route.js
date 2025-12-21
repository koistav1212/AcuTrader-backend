import { Router } from "express";
import { auth } from "../middleware/auth.js";
import * as userController from "../controllers/userController.js";

const router = Router();

/**
 * @openapi
 * /api/user/me:
 *   get:
 *     tags:
 *       - User
 *     summary: Get current user profile
 *     responses:
 *       200:
 *         description: User profile data
 */
router.get("/me", auth(), userController.me);

/**
 * @openapi
 * /api/user/portfolio:
 *   get:
 *     tags:
 *       - User
 *     summary: Get full portfolio summary (holdings, transactions, watchlist)
 *     responses:
 *       200:
 *         description: Portfolio data
 */
router.get("/portfolio", auth(), userController.portfolio);

/**
 * @openapi
 * /api/user/watchlist:
 *   get:
 *     tags:
 *       - User
 *     summary: Get user watchlist
 *     responses:
 *       200:
 *         description: List of watched stocks
 */
router.get("/watchlist", auth(), userController.getWatchlist);

/**
 * @openapi
 * /api/user/watchlist/toggle:
 *   post:
 *     tags:
 *       - User
 *     summary: Add or remove a stock from watchlist
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - symbol
 *             properties:
 *               symbol:
 *                 type: string
 *     responses:
 *       200:
 *         description: Toggle result (inWatchlist boolean)
 */
router.post("/watchlist/toggle", auth(), userController.toggleUserWatchlist);

/**
 * @openapi
 * /api/user/transactions:
 *   get:
 *     tags:
 *       - User
 *     summary: Get user transactions history
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Limit number of transactions returned (optional)
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of transactions
 */
router.get("/transactions", auth(), userController.getTransactions);

/**
 * @openapi
 * /api/user/buy:
 *   post:
 *     tags:
 *       - User
 *     summary: Buy stock
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - symbol
 *               - quantity
 *               - price
 *             properties:
 *               symbol:
 *                 type: string
 *               quantity:
 *                 type: number
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Transaction and holding details
 */
router.post("/buy", auth(), userController.buyStock);

/**
 * @openapi
 * /api/user/sell:
 *   post:
 *     tags:
 *       - User
 *     summary: Sell stock
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - symbol
 *               - quantity
 *               - price
 *             properties:
 *               symbol:
 *                 type: string
 *               quantity:
 *                 type: number
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Transaction and remaining holding details
 */
router.post("/sell", auth(), userController.sellStock);

export default router;
