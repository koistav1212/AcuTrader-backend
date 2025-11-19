import { getUserProfile } from "../services/userService.js";
import { getUserPortfolio, toggleWatchlist } from "../services/portfolioService.js";

export async function me(req, res, next) {
  try {
    const profile = await getUserProfile(req.user.id);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

export async function portfolio(req, res, next) {
  try {
    const data = await getUserPortfolio(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function toggleUserWatchlist(req, res, next) {
  try {
    const { symbol } = req.body;
    const result = await toggleWatchlist(req.user.id, symbol);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
