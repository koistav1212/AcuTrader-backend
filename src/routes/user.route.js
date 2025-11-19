import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { me, portfolio, toggleUserWatchlist } from "../controllers/userController.js";

const router = Router();

router.get("/me", auth(), me);
router.get("/portfolio", auth(), portfolio);
router.post("/watchlist/toggle", auth(), toggleUserWatchlist);

export default router;
