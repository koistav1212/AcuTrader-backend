import datetime
import pandas as pd

def extract_event_impact(articles):
    """
    Computes an impact score based on real FinBERT sentiment magnitude, 
    semantic relevance, source quality, event materiality, and recency.
    Modifies the list in place by adding fields.
    """
    if not articles:
        return articles
        
    current_time = datetime.datetime.utcnow()
    
    # Simple source quality proxy for demonstration (in a real system this would map from a DB of tiers)
    tier1_sources = ["bloomberg", "reuters", "wsj", "cnbc", "financial times"]
    tier2_sources = ["yahoo finance", "marketwatch", "seeking alpha", "fool", "barrons"]
    
    for a in articles:
        # 1. Sentiment Magnitude
        sentiment_magnitude = abs(a.get("finbert_sentiment_score", 0.0))
        
        # 2. Semantic Relevance
        relevance = a.get("semantic_relevance_score", 0.5)
        
        # 3. Source Quality
        source = (a.get("source") or "").lower()
        if any(t in source for t in tier1_sources):
            source_quality = 1.0
        elif any(t in source for t in tier2_sources):
            source_quality = 0.8
        else:
            source_quality = 0.5
            
        # 4. Event Materiality
        # A simple proxy based on event category
        cat = a.get("event_category", "other")
        high_materiality = ["earnings", "guidance", "regulation", "legal", "management", "capital_allocation"]
        medium_materiality = ["analyst", "product", "partnership", "customer_demand", "macro", "supply_chain", "competition"]
        if cat in high_materiality:
            event_materiality = 1.0
        elif cat in medium_materiality:
            event_materiality = 0.7
        else:
            event_materiality = 0.3
            
        # 5. Recency Weight
        # Decay over 30 days
        try:
            pub_date = pd.to_datetime(a.get("published_at"))
            # ensure naive or utc
            if pub_date.tzinfo is not None:
                pub_date = pub_date.tz_convert(None)
            days_old = (current_time - pub_date).days
            recency = max(0.1, 1.0 - (days_old / 30.0))
        except:
            recency = 0.5
            
        # Transparent Weighted Combination
        w_sent = 0.3
        w_mat = 0.3
        w_rel = 0.2
        w_src = 0.1
        w_rec = 0.1
        
        impact_score = (
            (sentiment_magnitude * w_sent) +
            (event_materiality * w_mat) +
            (relevance * w_rel) +
            (source_quality * w_src) +
            (recency * w_rec)
        )
        
        a["sentiment_magnitude"] = sentiment_magnitude
        a["source_quality_score"] = source_quality
        a["event_materiality_score"] = event_materiality
        a["recency_weight"] = recency
        a["impact_score"] = min(1.0, impact_score)
        
    return articles
