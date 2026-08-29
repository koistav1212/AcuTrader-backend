import { Router } from "express";
import * as researchController from "./research.controller.js";

const router = Router();

router.get("/:symbol", researchController.getResearch);
router.post("/batch", researchController.getResearchBatch);

export default router;
