import os
import json
import requests
from news_ingest import fetch_news_data
from news.embeddings import generate_embeddings

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
TICKER = "AAPL"

def test_pipeline():
    print("="*50)
    print("STAGE 1: NEWS FETCHING & PARSING")
    print("="*50)
    articles = fetch_news_data(TICKER, days=7)
    
    print("\nParsed News Output (Top 2 for brevity):")
    for i, a in enumerate(articles[:2]):
        print(f"Article {i+1}:")
        print(f"  Title: {a.get('title')}")
        print(f"  Source: {a.get('source')}")
        print(f"  Summary: {a.get('summary')[:100]}...")
    
    print("\n" + "="*50)
    print("STAGE 2: EMBEDDING GENERATION")
    print("="*50)
    
    # Generate embeddings
    embedded_articles = generate_embeddings(articles[:2])
    for i, a in enumerate(embedded_articles):
        emb = a.get('embedding')
        emb_preview = emb[:5] if emb else []
        print(f"Article {i+1} Embedding Size: {len(emb) if emb else 0}")
        print(f"Article {i+1} Embedding Preview: {emb_preview}")

    print("\n" + "="*50)
    print("STAGE 3: LLM VERIFICATION")
    print("="*50)
    
    news_summary = ""
    for idx, a in enumerate(articles[:5]):
        news_summary += f"Article {idx+1}:\nTitle: {a.get('title')}\nSummary: {a.get('summary')}\nSource: {a.get('source')}\n\n"
        
    prompt = f"""
    You are a strictly analytical financial verification assistant.
    Analyze the following recent news articles for the stock ticker {TICKER}.
    Determine the most material event currently affecting the company, if any.
    Verify if the event is highly relevant and likely to materially impact the company's fundamentals.
    Do NOT predict whether the stock will go up or down. Only evaluate the materiality of the event.
    
    News:
    {news_summary}
    
    Respond strictly in JSON format with the following keys:
    - verified_event (string: brief description of the most material event, or 'None' if no major event)
    - relevance_score (float 0 to 1: how relevant this event is to {TICKER})
    - impact_score (float 0 to 1: magnitude of fundamental impact, ignoring direction)
    - confidence (float 0 to 1: your confidence in this assessment based on source agreement)
    - supporting_sources (list of strings: names of the sources that reported this event)
    """

    print("\n--- MODEL INPUT (PROMPT) ---")
    print(prompt)
    print("----------------------------\n")
    
    print(f"Provider: Groq")
    print(f"Model Used: {GROQ_MODEL}")
    
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": GROQ_MODEL,
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
        response = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        
        result_text = response.json()['choices'][0]['message']['content']
        result_json = json.loads(result_text)
        
        print("\n--- MODEL OUTPUT (RESULT) ---")
        print(json.dumps(result_json, indent=2))
        print("-----------------------------\n")
        
    except Exception as e:
        print(f"LLM Verification failed: {e}")
        if 'response' in locals():
            print(f"Response: {response.text}")

if __name__ == "__main__":
    test_pipeline()
