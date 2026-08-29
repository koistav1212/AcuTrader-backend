import os
import json
import requests

def verify_news_events(symbol, articles):
    """
    Uses an LLM (OpenAI via direct HTTP request) to verify material events for the stock based on the news.
    Returns a structured verification output.
    Does NOT output stock prediction (bull/bear), only event materiality and verification.
    """
    if not articles:
        return {
            "verified_event": "No news available",
            "relevance_score": 0.0,
            "impact_score": 0.0,
            "confidence": 0.0,
            "supporting_sources": []
        }
        
    # We use OPENAI_API_KEY as the alternative to Groq. 
    # This avoids requiring a specific SDK installation since we can just use requests.
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Warning: OPENAI_API_KEY not set. Skipping LLM verification.")
        # Graceful fallback
        return {
            "verified_event": "Verification skipped (No API Key)",
            "relevance_score": 0.5,
            "impact_score": 0.5,
            "confidence": 0.2,
            "supporting_sources": []
        }
        
    # Prepare text summary of top articles
    news_summary = ""
    for idx, a in enumerate(articles[:5]): # Take top 5 to avoid context overflow
        news_summary += f"Article {idx+1}:\nTitle: {a.get('title')}\nSummary: {a.get('summary')}\nSource: {a.get('source')}\n\n"
        
    prompt = f"""
    You are a strictly analytical financial verification assistant.
    Analyze the following recent news articles for the stock ticker {symbol}.
    Determine the most material event currently affecting the company, if any.
    Verify if the event is highly relevant and likely to materially impact the company's fundamentals.
    Do NOT predict whether the stock will go up or down. Only evaluate the materiality of the event.
    
    News:
    {news_summary}
    
    Respond strictly in JSON format with the following keys:
    - verified_event (string: brief description of the most material event, or 'None' if no major event)
    - relevance_score (float 0 to 1: how relevant this event is to {symbol})
    - impact_score (float 0 to 1: magnitude of fundamental impact, ignoring direction)
    - confidence (float 0 to 1: your confidence in this assessment based on source agreement)
    - supporting_sources (list of strings: names of the sources that reported this event)
    """
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "gpt-4o-mini",  # fast, efficient, and cheap
        "response_format": { "type": "json_object" },
        "messages": [
            {
                "role": "system",
                "content": "You are a financial news verification engine. Output only valid JSON."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.0
    }
    
    try:
        response = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=15)
        response.raise_for_status()
        
        result_text = response.json()['choices'][0]['message']['content']
        result_json = json.loads(result_text)
        return result_json
        
    except Exception as e:
        print(f"LLM Verification failed: {e}")
        return {
            "verified_event": "Verification failed due to error",
            "relevance_score": 0.5,
            "impact_score": 0.5,
            "confidence": 0.2,
            "supporting_sources": []
        }
