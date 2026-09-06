import os
import torch
from transformers import pipeline

_finbert_pipeline = None

def get_finbert():
    global _finbert_pipeline
    if _finbert_pipeline is None:
        device = 0 if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else -1)
        if str(device) == "mps": device = "mps" 
        elif device == 0: device = 0
        else: device = -1
        
        try:
            _finbert_pipeline = pipeline("text-classification", model="ProsusAI/finbert", device=device, top_k=None)
        except Exception as e:
            print(f"Warning: Failed to load FinBERT on preferred device {device}. Falling back to CPU. Error: {e}")
            _finbert_pipeline = pipeline("text-classification", model="ProsusAI/finbert", device=-1, top_k=None)
    return _finbert_pipeline

def analyze_sentiment(articles):
    """
    Analyzes sentiment using FinBERT.
    Returns the articles with finbert probabilities and scores attached.
    """
    if not articles:
        return []
    
    finbert = get_finbert()
    
    valid_indices = []
    texts = []
    for idx, a in enumerate(articles):
        # Skip inference on duplicates or explicitly irrelevant items to save compute
        if a.get("isDuplicate", False) or not a.get("isRelevant", True):
            continue
            
        text = a.get("title", "") + " " + a.get("summary", "")
        # Truncate to avoid model max length issues
        texts.append(text[:512])
        valid_indices.append(idx)
        
    if texts:
        try:
            results = finbert(texts)
        except Exception as e:
            print(f"FinBERT prediction failed: {e}")
            results = []
    else:
        results = []

    result_idx = 0
    for idx, a in enumerate(articles):
        if idx in valid_indices and result_idx < len(results):
            # results[result_idx] is a list of dicts for each label because top_k=None
            probs = {res["label"]: res["score"] for res in results[result_idx]}
            
            pos = probs.get("positive", 0.0)
            neg = probs.get("negative", 0.0)
            neu = probs.get("neutral", 0.0)
            
            # Determine label
            label = "neutral"
            if pos > neg and pos > neu: label = "positive"
            elif neg > pos and neg > neu: label = "negative"
            
            a["finbert_positive_probability"] = pos
            a["finbert_negative_probability"] = neg
            a["finbert_neutral_probability"] = neu
            a["finbert_sentiment_score"] = pos - neg
            a["finbert_label"] = label
            a["finbert_model"] = "ProsusAI/finbert"
            result_idx += 1
        else:
            # Fallback/Skipped
            a["finbert_positive_probability"] = 0.0
            a["finbert_negative_probability"] = 0.0
            a["finbert_neutral_probability"] = 1.0
            a["finbert_sentiment_score"] = 0.0
            a["finbert_label"] = "neutral"
            a["finbert_model"] = "skipped_or_failed"
        
    return articles
