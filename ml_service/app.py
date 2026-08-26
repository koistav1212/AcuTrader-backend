from fastapi import FastAPI, HTTPException
import uvicorn
import os
from contextlib import asynccontextmanager
import yfinance as yf
import pandas as pd
import numpy as np
import datetime
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

import indicators
import strategy
import fundamentals
import market_data

from forecasting.ensemble import EnsembleForecaster
from features.technical import compute_technicals
from features.market import compute_market_features
from news.sentiment import analyze_sentiment
from news.intent import extract_event_impact
from calibration.probabilities import calibrate_probabilities

@asynccontextmanager
async def lifespan(app: FastAPI):
    port = os.getenv("PORT", 8000)
    mode = os.getenv("APP_ENV", "development")
    print(f"🚀 AcuTrader ML Service running in {mode} mode on port {port}")
    yield
    print("SIGTERM signal received: closing HTTP server")
    print("HTTP server closed")

app = FastAPI(title="AcuTrader ML Service", lifespan=lifespan)

print("Initializing ML ensemble...")
forecaster = EnsembleForecaster()
forecaster.load() # Try to load from disk
print("Model initialization complete.")

class PredictRequest(BaseModel):
    symbol: str
    horizon: int = 3
    ohlcv: List[Dict[str, Any]] = []
    news_features: List[Dict[str, Any]] = []
    technical_features: Dict[str, Any] = {}
    fundamental_features: Dict[str, Any] = {}
    prediction_timestamp: Optional[str] = None

class TrainRequest(BaseModel):
    symbol: str
    horizon: int = 3
    ohlcv: List[Dict[str, Any]] = []
    
@app.get("/health")
def health_check():
    return {
        "status": "healthy", 
        "service": "ml_service",
        "modelsLoaded": forecaster.loaded
    }

def _build_features_df(ohlcv_list):
    """ Converts OHLCV into a pandas dataframe with standard features """
    if not ohlcv_list:
        return pd.DataFrame()
        
    df = pd.DataFrame(ohlcv_list)
    # Ensure correct column names
    col_map = {c: c.lower() for c in df.columns}
    df = df.rename(columns=col_map)
    
    if 'datetime' in df.columns:
        df['datetime'] = pd.to_datetime(df['datetime'])
        df.set_index('datetime', inplace=True)
    elif 'date' in df.columns:
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)
        
    df.sort_index(inplace=True)
    
    # Calculate base features
    df['returns'] = df['close'].pct_change()
    df['volatility_20'] = df['returns'].rolling(20).std()
    df['sma_20'] = df['close'].rolling(20).mean()
    df['sma_50'] = df['close'].rolling(50).mean()
    df['momentum_10'] = df['close'].pct_change(10)
    
    # Drop NaNs from rolling
    df = df.dropna()
    return df

@app.post("/train")
def train_model(req: TrainRequest):
    try:
        df = _build_features_df(req.ohlcv)
        if len(df) < 100:
            raise ValueError(f"Insufficient history for training. Found {len(df)} rows.")
            
        # Target variables: log returns
        # y1 = log(Close[t+1] / Close[t])
        y = {}
        for day in range(1, req.horizon + 1):
            y[day] = np.log(df['close'].shift(-day) / df['close'])
            
        # Drop rows where target is NaN (the very end of the series)
        valid_idx = df.index[:-req.horizon]
        
        # Features X
        feature_cols = ['returns', 'volatility_20', 'sma_20', 'sma_50', 'momentum_10', 'volume']
        # Only use available columns
        feature_cols = [c for c in feature_cols if c in df.columns]
        X = df.loc[valid_idx, feature_cols]
        
        # Filter targets to match X
        y_train = {day: y[day].loc[valid_idx] for day in range(1, req.horizon + 1)}
        
        # Train ensemble
        forecaster.train(X, y_train)
        
        return {"success": True, "message": "Models trained successfully.", "rows_trained": len(X)}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/predict")
def predict_stock(req: PredictRequest):
    try:
        if not req.ohlcv or len(req.ohlcv) < 20:
            raise ValueError("Insufficient history for prediction.")
            
        # 1. Feature Engineering
        df = _build_features_df(req.ohlcv)
        if len(df) == 0:
            raise ValueError("Failed to build features from OHLCV.")
            
        feature_cols = ['returns', 'volatility_20', 'sma_20', 'sma_50', 'momentum_10', 'volume']
        feature_cols = [c for c in feature_cols if c in df.columns]
        
        # Get the latest row for point-in-time prediction
        X_latest = df[feature_cols].iloc[[-1]]
        current_price = df['close'].iloc[-1]
        
        # 2. Inference (returns log returns array)
        raw_pred = forecaster.predict(X_latest)
        
        # 3. Calibration
        volatility = df['volatility_20'].iloc[-1]
        if pd.isna(volatility) or volatility == 0:
            volatility = 0.02
            
        missing = 0
        if len(df) < 1000: missing += 0.2
        if not req.fundamental_features: missing += 0.1
        if not req.news_features: missing += 0.1
        data_completeness = max(0.1, 1.0 - missing)
        
        base_date = datetime.date.today()
        if req.prediction_timestamp:
            try:
                base_date = pd.to_datetime(req.prediction_timestamp).date()
            except:
                pass
                
        daily_forecasts = []
        for i in range(1, req.horizon + 1):
            target_date = (base_date + datetime.timedelta(days=i)).isoformat()
            
            # Extract prediction for horizon day (0-indexed in array)
            day_log_return = raw_pred[i-1] 
            
            calibrated = calibrate_probabilities(
                day_log_return, 
                current_price, 
                horizon_day=i, 
                volatility=volatility, 
                data_completeness=data_completeness
            )
            calibrated["date"] = target_date
            daily_forecasts.append(calibrated)
        
        return {
            "success": True,
            "symbol": req.symbol,
            "horizon": f"{req.horizon}d",
            "forecast": daily_forecasts,
            "model": {
                "ensembleLoaded": forecaster.loaded,
                "historyLength": len(df)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
