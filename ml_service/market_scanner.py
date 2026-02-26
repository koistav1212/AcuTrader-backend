import requests
import re
import pandas as pd
from io import StringIO

def get_most_active_tickers(limit=25):
    """
    Scrapes Yahoo Finance for the top 25 most active stocks.
    URL: https://finance.yahoo.com/markets/stocks/most-active/
    """
    print("Scraping Top 25 Most Active Tickers from Yahoo Finance...")
    
    # Fallback list in case of scraping failure
    fallback = ["TSLA", "NVDA", "AAPL", "AMD", "PLTR", "AMZN", "MSFT", "GOOGL", "META", "F", 
                "BAC", "T", "INTC", "CSCO", "CMCSA", "PFE", "VZ", "WFC", "KO", "XOM", "DIS", "NFLX", "NKE", "JPM", "V"]
    
    url = "https://finance.yahoo.com/markets/stocks/most-active/"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            print(f"Failed to fetch page: Status {response.status_code}")
            return fallback[:limit]

        # Method 1: Pandas read_html (Best for tables)
        try:
            dfs = pd.read_html(StringIO(response.text))
            for df in dfs:
                if 'Symbol' in df.columns:
                    print("Found table with 'Symbol' column.")
                    symbols = df['Symbol'].tolist()
                    # Clean symbols (remove garbage)
                    clean_symbols = [s for s in symbols if isinstance(s, str) and s.isalpha()]
                    if clean_symbols:
                        print(f"Successfully scraped {len(clean_symbols)} tickers via Pandas.")
                        return clean_symbols[:limit]
        except Exception as e:
            print(f"Pandas scraping failed: {e}. Trying regex.")

        # Method 2: Regex Fallback (data-symbol or Link structure)
        # Yahoo often puts symbols in links: /quote/TSLA?p=TSLA
        # or data-symbol="TSLA"
        
        symbols = re.findall(r'data-symbol="([A-Z]+)"', response.text)
        if not symbols:
            # Try finding Symbol in links
            symbols = re.findall(r'/quote/([A-Z]+)\?', response.text)
            
        seen = set()
        active = []
        for s in symbols:
            if s not in seen and s not in active:
                seen.add(s)
                active.append(s)
                
        if active:
            print(f"Successfully scraped {len(active)} tickers via Regex.")
            return active[:limit]
            
        print("No symbols found. Using fallback.")
        return fallback[:limit]

    except Exception as e:
        print(f"Scraping failed: {e}")
        return fallback[:limit]

if __name__ == "__main__":
    print(get_most_active_tickers())
