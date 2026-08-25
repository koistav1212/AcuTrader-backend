import { Router } from "express";
import * as forecastController from "./forecast.controller.js";

const router = Router();

router.get("/:symbol", forecastController.getForecast);

export default router;
