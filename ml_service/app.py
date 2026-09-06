from fastapi import FastAPI, HTTPException
import uvicorn
import os
from contextlib import asynccontextmanager
import pandas as pd
import numpy as np
import datetime
import json
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

import indicators
import strategy
import fundamentals
import market_data

from forecasting.ensemble import EnsembleForecaster
from features.technical import compute_technicals
from features.market import compute_market_features, generate_targets
from news.sentiment import analyze_sentiment
from news.impact import extract_event_impact
from news.embeddings import generate_embeddings
from calibration.probabilities import calibrate_probabilities

ARTIFACT_DIR = os.path.join(os.getcwd(), "news_audit_artifacts")
if not os.path.exists(ARTIFACT_DIR):
    os.makedirs(ARTIFACT_DIR)

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
    analysis_cutoff: Optional[str] = None
    window_start: Optional[str] = None
    window_end: Optional[str] = None
    audit: bool = False

class TrainRequest(BaseModel):
    symbol: str
    horizon: int = 3
    ohlcv: List[Dict[str, Any]] = []
    news_features: List[Dict[str, Any]] = [] 
    
@app.get("/health")
def health_check():
    return {
        "status": "healthy", 
        "service": "ml_service",
        "modelsLoaded": forecaster.loaded
    }

@app.post("/train")
def train_model(req: TrainRequest):
    try:
        df = compute_market_features(req.ohlcv, training=True)
        if len(df) < 100:
            raise ValueError(f"Insufficient history for training. Found {len(df)} rows.")
            
        y = generate_targets(df, horizon=req.horizon)
        valid_idx = df.index[:-req.horizon]
        
        exclude_cols = ['symbol', 'date', 'datetime']
        feature_cols = [c for c in df.columns if c not in exclude_cols]
        X = df.loc[valid_idx, feature_cols]
        
        y_train = {day: y[day].loc[valid_idx] for day in range(1, req.horizon + 1)}
        
        seq_len = 30
        input_size = 389
        X_news_seq = np.zeros((len(X), seq_len, input_size))
        
        forecaster.train(X, y_train, X_news_seq=X_news_seq)
        
        return {"success": True, "message": "Models trained successfully.", "rows_trained": len(X)}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/predict")
def predict_stock(req: PredictRequest):
    try:
        # Instead of completely blocking on 20 history rows, we will let market.py try
        df = compute_market_features(req.ohlcv, training=False)
        
        exclude_cols = ['symbol', 'date', 'datetime']
        feature_cols = [c for c in df.columns if c not in exclude_cols]
        
        X_latest = df[feature_cols].iloc[[-1]] if len(df) > 0 else pd.DataFrame()
        
        today_str = datetime.date.today().isoformat()
        if req.prediction_timestamp:
            try:
                today_str = pd.to_datetime(req.prediction_timestamp).date().isoformat()
            except:
                pass
                
        # Set up specific audit directory
        audit_dir = os.path.join(ARTIFACT_DIR, req.symbol.upper(), today_str) if getattr(req, 'audit', False) else ARTIFACT_DIR
        if getattr(req, 'audit', False) and not os.path.exists(audit_dir):
            os.makedirs(audit_dir)

        # 2. NLP Pipeline (News)
        raw_articles = req.news_features or []
        
        # In-place mutations
        raw_articles = generate_embeddings(raw_articles, symbol=req.symbol)
        raw_articles = analyze_sentiment(raw_articles)
        raw_articles = extract_event_impact(raw_articles)
                
        # Phase 10: Dataset A - Article Level
        df_articles = pd.DataFrame()
        df_daily = pd.DataFrame()
        
        if len(raw_articles) > 0:
            df_articles = pd.DataFrame(raw_articles)
            df_articles.to_parquet(os.path.join(audit_dir, f"news_articles_enriched.parquet"))
            
            if getattr(req, 'audit', False):
                # Dump finbert details
                finbert_dump = []
                for a in raw_articles:
                    finbert_dump.append({
                        "articleId": a.get("article_id"),
                        "publishedAt": a.get("published_at"),
                        "title": a.get("title"),
                        "finbert": {
                            "positive": a.get("finbert_positive_probability", 0),
                            "neutral": a.get("finbert_neutral_probability", 0),
                            "negative": a.get("finbert_negative_probability", 0),
                            "sentimentScore": a.get("finbert_sentiment_score", 0),
                            "label": a.get("finbert_label", "neutral")
                        }
                    })
                with open(os.path.join(audit_dir, "03_finbert_news.json"), "w") as f:
                    json.dump(finbert_dump, f, indent=2)

            df_articles['date'] = pd.to_datetime(df_articles['date']).dt.date
            
            daily_features = []
            grouped = df_articles.groupby('date')
            for d, group in grouped:
                daily_features.append({
                    "date": str(d),
                    "article_count": len(group),
                    "unique_source_count": group['source'].nunique() if 'source' in group else 0,
                    "positive_article_count": len(group[group.get('finbert_label') == 'positive']),
                    "negative_article_count": len(group[group.get('finbert_label') == 'negative']),
                    "neutral_article_count": len(group[group.get('finbert_label') == 'neutral']),
                    "positive_ratio": len(group[group.get('finbert_label') == 'positive']) / len(group),
                    "negative_ratio": len(group[group.get('finbert_label') == 'negative']) / len(group),
                    "mean_sentiment": group['finbert_sentiment_score'].mean(),
                    "weighted_sentiment": (group['finbert_sentiment_score'] * group['impact_score']).sum() / (group['impact_score'].sum() + 1e-9),
                    "sentiment_std": group['finbert_sentiment_score'].std() if len(group) > 1 else 0.0,
                    "mean_impact": group['impact_score'].mean(),
                    "total_impact": group['impact_score'].sum(),
                    "max_impact": group['impact_score'].max(),
                    "mean_relevance": group['semantic_relevance_score'].mean(),
                    "high_impact_article_count": len(group[group['impact_score'] >= 0.7]),
                    "earnings_count": len(group[group['event_category'] == 'earnings']),
                    "analyst_count": len(group[group['event_category'] == 'analyst']),
                    "product_count": len(group[group['event_category'] == 'product']),
                    "regulation_count": len(group[group['event_category'] == 'regulation']),
                    "partnership_count": len(group[group['event_category'] == 'partnership']),
                    "macro_count": len(group[group['event_category'] == 'macro']),
                    "legal_count": len(group[group['event_category'] == 'legal']),
                    "competition_count": len(group[group['event_category'] == 'competition'])
                })
            df_daily = pd.DataFrame(daily_features)
            df_daily.to_parquet(os.path.join(audit_dir, f"news_daily_features.parquet"))
            
            if getattr(req, 'audit', False):
                df_daily.to_csv(os.path.join(audit_dir, "05_daily_news_features.csv"), index=False)
                
                # We do simple clustering logging for 04_news_events since we generate embeddings
                events_dump = {
                    "embeddingModel": "all-MiniLM-L6-v2",
                    "articleCount": len(raw_articles),
                    "embeddingCount": len([x for x in raw_articles if 'embedding' in x]),
                    "events": [] # Placeholder for now, can be populated via extract_event_impact if needed
                }
                with open(os.path.join(audit_dir, "04_news_events.json"), "w") as f:
                    json.dump(events_dump, f, indent=2)

        # 3. Build Temporal Sequence for LSTM
        seq_len = 30
        input_size = 389
        news_seq = np.zeros((seq_len, input_size))
        
        base_date = pd.to_datetime(today_str).date()
        for i in range(seq_len):
            target_d = base_date - datetime.timedelta(days=(seq_len - 1 - i))
            if not df_daily.empty:
                day_row = df_daily[df_daily['date'] == str(target_d)]
                if not day_row.empty:
                    row = day_row.iloc[0]
                    day_articles = df_articles[df_articles['date'] == target_d]
                    if not day_articles.empty and 'embedding' in day_articles.columns:
                        emb_list = [np.array(e) for e in day_articles['embedding'].values if isinstance(e, list) and len(e) == 384]
                        if emb_list:
                            avg_emb = np.mean(emb_list, axis=0)
                            news_seq[i, :384] = avg_emb
                    news_seq[i, 384] = row.get('total_impact', 0.0)
                    news_seq[i, 385] = row.get('weighted_sentiment', 0.0)
                    news_seq[i, 386] = row.get('positive_ratio', 0.0)
                    news_seq[i, 387] = row.get('negative_ratio', 0.0)
                    news_seq[i, 388] = row.get('article_count', 0)
        
        if getattr(req, 'audit', False):
            np.savez(
                os.path.join(audit_dir, f"11_downstream_model_input.npz"),
                news_seq=news_seq,
                metadata={
                    "shape": news_seq.shape,
                    "lookback": seq_len,
                    "feature_count": input_size,
                    "sequence_start": str(base_date - datetime.timedelta(days=29)),
                    "sequence_end": str(base_date)
                }
            )

        top_ranked_events = []
        if not df_articles.empty:
            df_sorted = df_articles.sort_values(by="impact_score", ascending=False)
            top_k = min(15, len(df_sorted))
            top_events = df_sorted.head(top_k)
            for _, ev in top_events.iterrows():
                top_ranked_events.append({
                    "date": str(ev.get("date")),
                    "headline": ev.get("title"),
                    "source": ev.get("source"),
                    "finbert_positive": ev.get("finbert_positive_probability"),
                    "finbert_negative": ev.get("finbert_negative_probability"),
                    "finbert_sentiment_score": ev.get("finbert_sentiment_score"),
                    "impact": ev.get("impact_score"),
                    "relevance": ev.get("semantic_relevance_score"),
                    "category": ev.get("event_category")
                })

        context_dataset = {
            "analysis_cutoff": req.analysis_cutoff,
            "window_start": req.window_start,
            "window_end": req.window_end,
            "article_count": len(raw_articles),
            "daily_features": df_daily.to_dict('records') if not df_daily.empty else [],
            "top_ranked_events": top_ranked_events,
            "embedding_model": "all-MiniLM-L6-v2",
            "finbert_model": "ProsusAI/finbert"
        }
        
        if getattr(req, 'audit', False):
            with open(os.path.join(audit_dir, f"05b_news_model_context.json"), "w") as f:
                json.dump(context_dataset, f, indent=2)
                
            if len(X_latest) > 0:
                with open(os.path.join(audit_dir, f"10_xgboost_input.json"), "w") as f:
                    json.dump({"features": X_latest.to_dict('records')[0], "shape": X_latest.shape}, f, indent=2)

        # 4. Multimodal Inference (XGBoost)
        daily_forecasts = []
        if len(X_latest) > 0:
            raw_pred, probabilities, news_encoding = forecaster.predict(X_latest, news_seq=news_seq)
            for i in range(1, req.horizon + 1):
                target_date = (base_date + datetime.timedelta(days=i)).isoformat()
                day_log_return = float(raw_pred[i-1])
                day_probs = probabilities[i-1]
                daily_forecasts.append({
                    "date": target_date,
                    "expected_return": day_log_return,
                    "probabilities": day_probs
                })
        
        return {
            "success": True if len(X_latest) > 0 else False,
            "symbol": req.symbol,
            "horizon": f"{req.horizon}d",
            "forecast": daily_forecasts,
            "news_context": context_dataset,
            "model": {
                "ensembleLoaded": forecaster.loaded,
                "historyLength": len(df)
            }
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
