import axios from "axios";
import { config } from "../config/env.js";

class MLServiceClient {
  constructor() {
    this.baseUrl = config.pythonServiceUrl || process.env.ML_SERVICE_URL || "http://localhost:8000";
  }

  async checkHealth() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
      return response.data;
    } catch (error) {
      console.error("[MLServiceClient] Health check failed:", error.message);
      return { status: "unhealthy", error: error.message };
    }
  }

  async getPrediction(payload) {
    try {
      const response = await axios.post(`${this.baseUrl}/predict`, payload, { timeout: 15000 });
      return response.data;
    } catch (error) {
      console.error("[MLServiceClient] Predict request failed:", error.message);
      if (error.response) {
         console.error("[MLServiceClient] Predict error data:", error.response.data);
      }
      throw new Error("ML_SERVICE_UNAVAILABLE");
    }
  }

  async trainModel(payload) {
    try {
      const response = await axios.post(`${this.baseUrl}/train`, payload, { timeout: 60000 });
      return response.data;
    } catch (error) {
      console.error("[MLServiceClient] Train request failed:", error.message);
      throw error;
    }
  }
}

export default new MLServiceClient();
