import axios from "axios";
import { config } from "../../config/env.js";

class ForecastService {
  async getForecastForSymbol(symbol, ohlcv = [], news_features = [], technical_features = {}, fundamental_features = {}) {
    const mlUrl = config.pythonServiceUrl || "http://localhost:8000";
    try {
      const response = await axios.post(`${mlUrl}/predict`, {
        symbol,
        horizon: 3,
        ohlcv,
        news_features,
        technical_features,
        fundamental_features
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to get forecast for ${symbol} from ML service:`, error.message);
      return {
        symbol,
        horizon: "3d",
        scenarios: {
          bull: { probability: 0, targetPrice: 0 },
          base: { probability: 0, targetPrice: 0 },
          bear: { probability: 0, targetPrice: 0 }
        },
        expectedTarget: 0,
        confidence: 0
      };
    }
  }
}

export default new ForecastService();
