import { Router } from "express";
import * as newsController from "./news.controller.js";

const router = Router();

router.get("/:symbol", newsController.getNews);

export default router;
