from fastapi import FastAPI, HTTPException
import uvicorn
import yfinance as yf
import pandas as pd
import numpy as np

# Import from existing scripts
import indicators
import strategy
import fundamentals

app = FastAPI(title="AcuTrader ML Service")

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "acutrader-ml-service"}

import market_data

@app.get("/internal/market/history")
def get_internal_market_history(symbol: str, range: str = "1M", interval: str = "1d"):
    result = market_data.fetch_history(symbol, range, interval)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to fetch data"))
    return result

@app.get("/api/ml/indicators")
def get_indicators(symbol: str):
    try:
        df = indicators.fetch_data(symbol)
        techs = indicators.compute_indicators(df)
        return {"symbol": symbol, "data": techs}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/ml/regime")
def get_market_regime(symbol: str = "SPY"):
    try:
        df = indicators.fetch_data(symbol)
        techs = indicators.compute_indicators(df)
        
        # Simple Regime Classification based on SPY or given symbol
        price = techs.get("current_price", 0)
        sma200 = techs.get("SMA_200", 0)
        sma50 = techs.get("SMA_50", 0)
        volatility = techs.get("Volatility", 0)
        
        if price > sma200 and sma50 > sma200:
            if volatility > 0.02:
                regime = "Volatile Bull"
            else:
                regime = "Steady Bull"
        elif price < sma200 and sma50 < sma200:
            if volatility > 0.025:
                regime = "Volatile Bear"
            else:
                regime = "Steady Bear"
        else:
            regime = "Ranging / Transition"
            
        return {
            "symbol": symbol,
            "regime": regime,
            "confidence": 0.85 # Placeholder for a more complex confidence model
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/ml/seasonality")
def get_seasonality(symbol: str, period: str = "monthly"):
    try:
        # Fetch 5 years of data for better seasonality
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="5y")
        if df.empty:
            raise ValueError("No data returned")
            
        df['Return'] = df['Close'].pct_change()
        
        if period == "monthly":
            # Group by month (1-12)
            df['Month'] = df.index.month
            monthly_avg = df.groupby('Month')['Return'].mean() * 100 # percentage
            
            month_names = {1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun", 
                           7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec"}
            
            data = []
            for m in range(1, 13):
                avg_ret = monthly_avg.get(m, 0.0)
                data.append({"month": month_names[m], "avgReturn": round(avg_ret, 2)})
                
        elif period == "weekly":
            # Group by day of week (0-4 usually for trading days)
            df['DayOfWeek'] = df.index.dayofweek
            weekly_avg = df.groupby('DayOfWeek')['Return'].mean() * 100
            
            day_names = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri"}
            
            data = []
            for d in range(5):
                avg_ret = weekly_avg.get(d, 0.0)
                data.append({"day": day_names[d], "avgReturn": round(avg_ret, 2)})
        else:
            raise ValueError("Period must be 'monthly' or 'weekly'")
            
        return {
            "symbol": symbol,
            "period": period,
            "data": data
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))



from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class PredictRequest(BaseModel):
    symbol: str
    horizon: int = 3
    ohlcv: List[Dict[str, Any]] = []
    news_features: List[Dict[str, Any]] = []
    technical_features: Dict[str, Any] = {}
    fundamental_features: Dict[str, Any] = {}

from forecasting.ensemble import EnsembleForecaster
from features.fusion import build_feature_tensor
from features.technical import compute_technicals
from features.market import compute_market_features
from news.sentiment import analyze_sentiment
from news.intent import extract_event_impact
from calibration.probabilities import calibrate_probabilities

# Initialize global model once
print("Loading global ML ensemble...")
forecaster = EnsembleForecaster()
print("Model loaded successfully.")

@app.post("/predict")
def predict_stock(req: PredictRequest):
    try:
        # 1. News Analysis
        news_sent = analyze_sentiment(req.news_features)
        news_impact = extract_event_impact(req.news_features)
        
        # 2. Features
        # Normally we'd compute this from req.ohlcv if not provided
        tech = req.technical_features or compute_technicals(req.ohlcv)
        market = compute_market_features(req.symbol)
        fund = req.fundamental_features
        
        # 3. Fusion
        tensor = build_feature_tensor(req.ohlcv, tech, market, news_sent, news_impact, fund)
        
        # 4. Inference
        raw_pred = forecaster.predict(tensor)
        
        # 5. Calibration
        # Get current price from ohlcv or technicals
        current_price = tech.get("current_price", 100.0)
        if req.ohlcv and len(req.ohlcv) > 0:
            current_price = req.ohlcv[-1].get("close", current_price)
            
        calibrated = calibrate_probabilities(raw_pred, current_price)
        
        return {
            "symbol": req.symbol,
            "horizon": f"{req.horizon}d",
            "currentPrice": current_price,
            "scenarios": calibrated["scenarios"],
            "expectedTarget": calibrated["expectedTarget"],
            "expectedReturn": calibrated["expectedReturn"],
            "confidence": calibrated["confidence"]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
