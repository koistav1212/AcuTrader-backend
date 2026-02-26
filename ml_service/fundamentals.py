import yfinance as yf

def compute_fundamentals(ticker_symbol):
    """
    Fetches fundamental data for a ticker using yfinance.
    Returns a dictionary with marketCap, peRatio, eps, revenueGrowth, beta.
    Always returns a dictionary with keys, values may be None if fetch fails.
    """
    print(f"Fetching fundamentals for {ticker_symbol}...")
    
    fundamentals = {
        "marketCap": None,
        "peRatio": None,
        "eps": None,
        "revenueGrowth": None,
        "beta": None
    }
    
    try:
        ticker = yf.Ticker(ticker_symbol)
        info = ticker.info
        
        fundamentals["marketCap"] = info.get("marketCap")
        fundamentals["peRatio"] = info.get("trailingPE")
        fundamentals["eps"] = info.get("trailingEps")
        fundamentals["revenueGrowth"] = info.get("revenueGrowth")
        fundamentals["beta"] = info.get("beta")
        
    except Exception as e:
        print(f"Error fetching fundamentals for {ticker_symbol}: {e}")
        
    return fundamentals

if __name__ == "__main__":
    print(compute_fundamentals("TSLA"))
