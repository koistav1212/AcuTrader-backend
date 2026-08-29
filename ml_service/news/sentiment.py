import os
import torch
from transformers import pipeline

# We initialize the model lazily to avoid loading it on every import if not needed
_finbert_pipeline = None

def get_finbert():
    global _finbert_pipeline
    if _finbert_pipeline is None:
        device = 0 if torch.cuda.is_available() else (-1 if not torch.backends.mps.is_available() else "mps")
        # For simplicity on MPS or CPU, we might just use CPU to avoid issues with some ops, but pipeline usually handles it
        if str(device) == "mps": device = "mps" 
        elif device == 0: device = 0
        else: device = -1
        
        try:
            _finbert_pipeline = pipeline("text-classification", model="ProsusAI/finbert", device=device)
        except Exception as e:
            print(f"Warning: Failed to load FinBERT on preferred device {device}. Falling back to CPU. Error: {e}")
            _finbert_pipeline = pipeline("text-classification", model="ProsusAI/finbert", device=-1)
    return _finbert_pipeline

def analyze_sentiment(articles):
    """
    Analyzes sentiment using FinBERT.
    Expected to return the overall sentiment, plus positive/negative/neutral breakdown.
    For this implementation, we take a list of articles, run them through FinBERT, and return the average score.
    """
    if not articles:
        return {"score": 0.0, "positive": 0.0, "negative": 0.0, "neutral": 1.0}
    
    finbert = get_finbert()
    
    texts = []
    for a in articles:
        text = a.get("title", "") + " " + a.get("summary", "")
        # Truncate to avoid model max length issues
        texts.append(text[:512])
        
    try:
        results = finbert(texts)
    except Exception as e:
        print(f"FinBERT prediction failed: {e}")
        return {"score": 0.0, "positive": 0.0, "negative": 0.0, "neutral": 1.0}

    pos = 0.0
    neg = 0.0
    neu = 0.0
    
    for res in results:
        label = res["label"]
        score = res["score"]
        if label == "positive": pos += score
        elif label == "negative": neg += score
        else: neu += score
        
    n = len(results)
    
    # Calculate a composite score [-1 to 1]
    # Assuming positive pulls to +1, negative to -1, neutral to 0
    total_pos = pos / n
    total_neg = neg / n
    total_neu = neu / n
    
    composite = total_pos - total_neg
    
    return {
        "score": composite,
        "positive": total_pos,
        "negative": total_neg,
        "neutral": total_neu
    }
