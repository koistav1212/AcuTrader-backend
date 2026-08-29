import { Router } from "express";
import mlServiceClient from "../services/mlServiceClient.js";

const router = Router();

router.get("/health", async (req, res, next) => {
  try {
    const mlHealth = await mlServiceClient.checkHealth();
    
    res.json({
      node: true,
      python: mlHealth.status === "healthy",
      modelsLoaded: mlHealth.modelsLoaded || false,
      mlServiceUrlConfigured: !!process.env.ML_SERVICE_URL || !!mlServiceClient.baseUrl
    });
  } catch (error) {
    res.json({
      node: true,
      python: false,
      modelsLoaded: false,
      mlServiceUrlConfigured: !!process.env.ML_SERVICE_URL || !!mlServiceClient.baseUrl,
      error: error.message
    });
  }
});

export default router;
