import sys
import os
import json

# Add current directory to path so we can import modules
sys.path.append(os.getcwd())

import ml_service.generate_insights as gi

# Mock to avoid scraping 25 tickers
def mock_get_tickers(limit=25):
    print("MOCK: Returning ['TSLA'] for testing.")
    return ["TSLA"]

def mock_fetch_news(ticker, days=14):
    print(f"MOCK: Fetching news for {ticker}")
    return [
        {"title": "Tesla Stock Jumps", "summary": "Shares are up.", "link": "http://example.com", "published": "2024-01-01", "source": "Mock"},
        {"title": "Elon Musk Tweets", "summary": "Something about AI.", "link": "http://example.com", "published": "2024-01-02", "source": "Mock"}
    ]

if __name__ == "__main__":
    gi.get_most_active_tickers = mock_get_tickers
    gi.fetch_news_data = mock_fetch_news
    
    # Run pipeline
    gi.main()
    
    # Verify Output
    OUTPUT_FILE = "ml_service/insights_cache.json"
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r") as f:
            data = json.load(f)
            
        tsla = data.get("TSLA", {})
        print("\n--- Verification Report ---")
        print(f"Fundamentals Present: {bool(tsla.get('fundamentals'))}")
        print(f"Technicals Present: {bool(tsla.get('technicals'))}")
        print(f"Trade Report Present: {bool(tsla.get('trade_report'))}")
        print(f"News Summary Length: {len(tsla.get('news_summary', ''))}")
        print(f"News Count: {tsla.get('news_count')}")
        
        # Check specifically for strict separation
        if "error" in tsla.get("technicals", {}):
            print("WARNING: Technicals contain error.")
        if "error" in tsla.get("fundamentals", {}):
            print("WARNING: Fundamentals contain error.")
            
        print("Success: Pipeline ran and produced JSON.")
    else:
        print("FAIL: No output file generated.")
