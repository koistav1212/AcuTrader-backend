import json
import os
from datetime import datetime
import time

# --- Financial Modules ---
from fundamentals import compute_fundamentals
from indicators import fetch_data, compute_indicators
from strategy import generate_detailed_strategy

# --- News Pipeline Modules ---
from news_ingest import fetch_news_data, get_rss_feeds # get_rss for debug if needed
from news_categorize import categorize_news
from news_summarize import NewsSummarizer
from market_scanner import get_most_active_tickers


OUTPUT_FILE = "ml_service/insights_cache.json"

def main():
    print(f"Starting Daily Equity Research Batch: {datetime.now()}")
    
    # 1. Initialize Global Models
    try:
        summarizer = NewsSummarizer()
    except Exception as e:
        print(f"Failed to init summarizer: {e}")
        summarizer = None
    
    # 2. Get Tickers (Source of Truth)
    tickers = get_most_active_tickers(limit=25)
    # tickers = ["TSLA", "AAPL"] # Debug
    
    insights = {}
    
    for ticker in tickers:
        print(f"\n========================================\nProcessing {ticker}\n========================================")
        
        # Initialize result object for this ticker
        # This guarantees keys exist even if everything fails
        ticker_result = {
            "last_updated": datetime.now().isoformat(),
            "fundamentals": {},
            "technicals": {},
            "trade_report": {},
            "news_summary": "Data Pending",
            "news_count": 0,
            "sentiment": {"verdict": "Neutral", "overall_score": 0, "counts": {}} # Default placeholder
        }
        
        # --- STEP 1: FUNDAMENTALS ---
        try:
            print("STEP 1: Computing Fundamentals...")
            fund = compute_fundamentals(ticker)
            ticker_result["fundamentals"] = fund
        except Exception as e:
            print(f"CRITICAL ERROR in Fundamentals: {e}")
            ticker_result["fundamentals"] = {"error": str(e)}

        # --- STEP 2: TECHNICALS ---
        try:
            print("STEP 2: Computing Technicals...")
            df = fetch_data(ticker)
            if df is not None and not df.empty:
                tech = compute_indicators(df)
                ticker_result["technicals"] = tech
            else:
                ticker_result["technicals"] = {"error": "No data returned"}
        except Exception as e:
            print(f"CRITICAL ERROR in Technicals: {e}")
            ticker_result["technicals"] = {"error": str(e)}

        # --- STEP 3: TRADE PLAN & STRATEGY ---
        try:
            print("STEP 3: Generating Trade Plan...")
            # We strictly need technicals for this.
            # Convert technicals to dict if it's not empty, mostly handled by compute_indicators safe_get
            # Strategy module now returns valid structs even on empty/zero inputs
            
            # Use 'technicals' from the result object which is now populated (or has error)
            tech_data = ticker_result.get("technicals", {})
            fund_data = ticker_result.get("fundamentals", {})
            
            # Dummy sentiment data for strategy if not yet computed (News is step 4)
            # Strategy.py uses sentiment score to adjust probability, defaulting to 0 is fine
            dummy_sent = {"overall_score": 0} 
            
            plan = generate_detailed_strategy(tech_data, dummy_sent, fund_data)
            ticker_result["trade_report"] = plan
            
        except Exception as e:
            print(f"CRITICAL ERROR in Trade Plan: {e}")
            ticker_result["trade_report"] = {"error": str(e)}

        # --- STEP 4: NEWS PIPELINE ---
        try:
            print("STEP 4: Fetching & Summarizing News...")
            
            # A. Fetch
            articles = fetch_news_data(ticker, days=14)
            ticker_result["news_count"] = len(articles)
            
            if articles:
                # B. Categorize
                grouped_news = categorize_news(articles)
                
                # C. Summarize (LLM)
                if summarizer:
                    research_note = summarizer.generate_summary(grouped_news)
                    ticker_result["news_summary"] = research_note
                else:
                    ticker_result["news_summary"] = "AI Summarizer unavailable."
                    
                # D. (Optional) Sentiment recalculation if we want it in the final object
                # For now using a placeholder or we could import the SentimentAnalyzer again
                # Adding basic sentiment logic here or sticking to the requirement "news_summary" is text
                
            else:
                ticker_result["news_summary"] = "No recent news found."

        except Exception as e:
            print(f"CRITICAL ERROR in News Pipeline: {e}")
            ticker_result["news_summary"] = f"News processing failed: {str(e)}"
            
        # --- STEP 5: MERGE & SAVE ---
        # We already populated `ticker_result` incrementally.
        insights[ticker] = ticker_result

    # Final Save
    try:
        with open(OUTPUT_FILE, "w") as f:
            json.dump(insights, f, indent=4, default=str)
        print(f"\nBatch Job Completed. Insights saved to {OUTPUT_FILE}")
    except Exception as e:
        print(f"Failed to write output file: {e}")

if __name__ == "__main__":
    main()
