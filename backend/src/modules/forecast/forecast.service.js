import mlServiceClient from "../../services/mlServiceClient.js";

class ForecastService {
  async getForecastForSymbol(symbol, ohlcv = [], news_features = [], technical_features = {}, fundamental_features = {}, forecastPayload = {}) {
    try {
      console.log(`[Node] ML request → ${symbol}`);
      
      const payload = {
        symbol,
        horizon: 3,
        ohlcv,
        news_features,
        technical_features,
        fundamental_features,
        prediction_timestamp: new Date().toISOString(),
        analysis_cutoff: forecastPayload.analysis_cutoff,
        window_start: forecastPayload.window_start,
        window_end: forecastPayload.window_end,
        audit: forecastPayload.audit || false
      };

      const response = await mlServiceClient.getPrediction(payload);
      
      console.log(`[Node] ML response received → ${symbol}`);
      return response;
      
    } catch (error) {
      if (error.message === "ML_SERVICE_UNAVAILABLE") {
        return {
          success: false,
          forecastStatus: "ML_SERVICE_UNAVAILABLE"
        };
      }
      
      console.error(`Failed to get forecast for ${symbol}:`, error.message);
      return {
        success: false,
        forecastStatus: "ERROR",
        message: error.message
      };
    }
  }
}

export default new ForecastService();
