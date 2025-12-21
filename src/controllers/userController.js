import { getUserProfile } from "../services/userService.js";
import * as portfolioService from "../services/portfolioService.js";
import * as transactionService from "../services/transactionService.js";

export async function me(req, res, next) {
  try {
    const profile = await getUserProfile(req.user.id);
    if (!profile) {
        const error = new Error("User profile not found");
        error.status = 404;
        throw error;
    }
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

export async function portfolio(req, res, next) {
  try {
    const data = await portfolioService.getUserPortfolio(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function toggleUserWatchlist(req, res, next) {
  try {
    const { symbol } = req.body;
    if (!symbol) {
        throw new Error("Symbol is required");
    }
    const result = await portfolioService.toggleWatchlist(req.user.id, symbol);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getWatchlist(req, res, next) {
  try {
    const watchlist = await portfolioService.getWatchlist(req.user.id);
    res.json(watchlist);
  } catch (err) {
    next(err);
  }
}

export async function getTransactions(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 0;
    const transactions = await portfolioService.getTransactions(req.user.id, limit);
    res.json(transactions);
  } catch (err) {
    next(err);
  }
}

export async function buyStock(req, res, next) {
  try {
    const { symbol, quantity, price } = req.body;
    if (!symbol || !quantity || !price) {
        throw new Error("Symbol, quantity, and price are required");
    }
    const result = await transactionService.buyStock(req.user.id, symbol, Number(quantity), Number(price));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function sellStock(req, res, next) {
  try {
    const { symbol, quantity, price } = req.body;
    if (!symbol || !quantity || !price) {
        throw new Error("Symbol, quantity, and price are required");
    }
    const result = await transactionService.sellStock(req.user.id, symbol, Number(quantity), Number(price));
    res.json(result);
  } catch (err) {
    next(err);
  }
}
