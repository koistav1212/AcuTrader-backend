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
from news.impact import extract_event_impact
from news.embeddings import generate_embeddings
from news.verification import verify_news_events
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
    news_features: List[Dict[str, Any]] = [] # Optional historical news for training
    
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
        
        # Build mock news sequences for training if none provided
        # In a production setting, this should be real historical news aligned by date
        # (N, seq_len, 389)
        seq_len = 30
        input_size = 389
        X_news_seq = np.zeros((len(X), seq_len, input_size))
        
        # Train ensemble
        forecaster.train(X, y_train, X_news_seq=X_news_seq)
        
        return {"success": True, "message": "Models trained successfully.", "rows_trained": len(X)}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/predict")
def predict_stock(req: PredictRequest):
    try:
        if not req.ohlcv or len(req.ohlcv) < 20:
            raise ValueError("Insufficient history for prediction.")
            
        # 1. Feature Engineering (Quant)
        df = _build_features_df(req.ohlcv)
        if len(df) == 0:
            raise ValueError("Failed to build features from OHLCV.")
            
        feature_cols = ['returns', 'volatility_20', 'sma_20', 'sma_50', 'momentum_10', 'volume']
        feature_cols = [c for c in feature_cols if c in df.columns]
        
        X_latest = df[feature_cols].iloc[[-1]]
        current_price = df['close'].iloc[-1]
        
        # 2. NLP Pipeline (News)
        # We process the recent news window
        raw_articles = req.news_features or []
        
        # We limit to last 30 articles for performance if there's a huge dump
        raw_articles = raw_articles[:30]
        
        sentiment_result = analyze_sentiment(raw_articles)
        impact_result = extract_event_impact(raw_articles)
        embedded_articles = generate_embeddings(raw_articles)
        verification_result = verify_news_events(req.symbol, raw_articles)
        
        # 3. Build Temporal Sequence for LSTM
        # Real implementation would map articles to exact trading days over 30 days.
        # Here we build a sequence of the recent news available at prediction time.
        seq_len = 30
        input_size = 389
        news_seq = np.zeros((seq_len, input_size))
        
        # Fill the last sequence step with the aggregate of recent news
        if embedded_articles and 'embedding' in embedded_articles[0]:
            # average embedding
            avg_emb = np.mean([a['embedding'] for a in embedded_articles if 'embedding' in a], axis=0)
            if len(avg_emb) == 384:
                news_seq[-1, :384] = avg_emb
                news_seq[-1, 384] = impact_result.get('impact', 0.0)
                news_seq[-1, 385] = sentiment_result.get('score', 0.0)
                news_seq[-1, 386] = sentiment_result.get('positive', 0.0)
                news_seq[-1, 387] = sentiment_result.get('negative', 0.0)
                news_seq[-1, 388] = impact_result.get('news_count', 0)
        
        # 4. Multimodal Inference
        raw_pred, probabilities, news_encoding = forecaster.predict(X_latest, news_seq=news_seq)
        
        # 5. Output Formatting
        volatility = df['volatility_20'].iloc[-1]
        if pd.isna(volatility) or volatility == 0:
            volatility = 0.02
            
        base_date = datetime.date.today()
        if req.prediction_timestamp:
            try:
                base_date = pd.to_datetime(req.prediction_timestamp).date()
            except:
                pass
                
        daily_forecasts = []
        for i in range(1, req.horizon + 1):
            target_date = (base_date + datetime.timedelta(days=i)).isoformat()
            
            day_log_return = float(raw_pred[i-1])
            day_probs = probabilities[i-1]
            
            # Use probability max to determine expected return direction magnitude 
            # Or just pass the probabilities back directly.
            
            daily_forecasts.append({
                "date": target_date,
                "expected_return": day_log_return,
                "probabilities": day_probs
            })
        
        return {
            "success": True,
            "symbol": req.symbol,
            "horizon": f"{req.horizon}d",
            "forecast": daily_forecasts,
            "news_signal": {
                "sentiment": sentiment_result,
                "impact": impact_result,
                "verified_events": verification_result,
                "news_count": impact_result.get("news_count", 0),
                "encoding_norm": float(np.linalg.norm(news_encoding))
            },
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
