import datetime
import pandas as pd

def extract_event_impact(articles):
    """
    Dummy implementation replaced.
    This module computes an impact score and aggregates articles by date.
    
    Articles is a list of dicts. Expects fields: 'title', 'summary', 'publishedAt', 'sentiment'
    """
    if not articles:
        return {"impact": 0.0, "news_count": 0, "daily_sentiment": {}}
        
    df = pd.DataFrame(articles)
    
    # Calculate a simple impact score per article
    # In a real scenario, this would use source authority, length, relevance matching.
    # For now, we will assign impact based on sentiment strength.
    def calculate_impact(row):
        base_impact = 0.5
        # If sentiment is available, stronger sentiment = higher impact
        if 'sentiment' in row and isinstance(row['sentiment'], dict):
            # The absolute value of the composite score
            score = row['sentiment'].get('score', 0)
            base_impact += abs(score) * 0.5
        return min(base_impact, 1.0)
        
    df['impact'] = df.apply(calculate_impact, axis=1)
    
    # Ensure date is parsed
    if 'publishedAt' in df.columns:
        df['date'] = pd.to_datetime(df['publishedAt']).dt.date
    else:
        df['date'] = datetime.date.today()
        
    # Aggregate daily
    daily_stats = {}
    for date, group in df.groupby('date'):
        daily_impact = group['impact'].mean()
        if 'sentiment' in df.columns and len(group) > 0 and isinstance(group.iloc[0].get('sentiment'), dict):
            pos = group.apply(lambda r: r['sentiment'].get('positive', 0) * r['impact'], axis=1).sum() / group['impact'].sum()
            neg = group.apply(lambda r: r['sentiment'].get('negative', 0) * r['impact'], axis=1).sum() / group['impact'].sum()
            neu = group.apply(lambda r: r['sentiment'].get('neutral', 0) * r['impact'], axis=1).sum() / group['impact'].sum()
            score = group.apply(lambda r: r['sentiment'].get('score', 0) * r['impact'], axis=1).sum() / group['impact'].sum()
        else:
            pos, neg, neu, score = 0, 0, 1, 0
            
        daily_stats[date.isoformat()] = {
            "impact": daily_impact,
            "count": len(group),
            "sentiment": {
                "positive": pos,
                "negative": neg,
                "neutral": neu,
                "score": score
            }
        }
        
    overall_impact = df['impact'].mean()
    
    return {
        "impact": overall_impact,
        "news_count": len(articles),
        "daily_stats": daily_stats
    }
