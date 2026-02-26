import yfinance as yf
import pandas as pd
import ta
import numpy as np
import requests

def fetch_data(ticker):
    """
    Fetches historical data for a ticker using yfinance with custom session.
    """
    print(f"Fetching technical data for {ticker}...")
    try:
        dat = yf.Ticker(ticker).history(period="1y")
        
        if dat.empty:
            raise ValueError("No data returned")
            
        return dat
    except Exception as e:
        print(f"yfinance download failed: {e}")
        raise

def compute_indicators(df):
    """
    Computes technical indicators: RSI, MACD, SMA, BB, ATR, Volatility.
    """
    if df is None or df.empty:
        return {}
    
    # Ensure High, Low, Close are available
    close = df['Close']
    high = df['High']
    low = df['Low']
    
    # 1. RSI
    df['RSI'] = ta.momentum.rsi(close, window=14)
    
    # 2. MACD
    macd = ta.trend.MACD(close)
    df['MACD'] = macd.macd()
    df['MACD_Signal'] = macd.macd_signal()
    
    # 3. SMA
    df['SMA_20'] = ta.trend.sma_indicator(close, window=20)
    df['SMA_50'] = ta.trend.sma_indicator(close, window=50)
    df['SMA_200'] = ta.trend.sma_indicator(close, window=200)
    
    # 4. Bollinger Bands
    bb = ta.volatility.BollingerBands(close, window=20, window_dev=2)
    df['BB_High'] = bb.bollinger_hband()
    df['BB_Low'] = bb.bollinger_lband()
    
    # 5. ATR
    df['ATR'] = ta.volatility.average_true_range(high, low, close)
    
    # 6. Volatility (Std Dev of returns)
    df['Volatility'] = close.pct_change().rolling(window=20).std()
    
    # 7. Volume Spike (Volume > 2 * Avg Volume)
    df['Avg_Volume'] = df['Volume'].rolling(window=20).mean()
    df['Volume_Spike'] = df['Volume'] > (df['Avg_Volume'] * 2)

    
    # Return latest values
    latest = df.iloc[-1]
    
    # Safeguard against NaN
    def safe_get(key, decimals=2):
        val = latest.get(key)
        if val is None or np.isnan(val):
            return 0.0
        return round(float(val), decimals)

    indicators = {
        "current_price": safe_get('Close'),
        "RSI": safe_get('RSI'),
        "MACD": safe_get('MACD'),
        "MACD_Signal": safe_get('MACD_Signal'),
        "SMA_20": safe_get('SMA_20'),
        "SMA_50": safe_get('SMA_50'),
        "SMA_200": safe_get('SMA_200'),
        "BB_High": safe_get('BB_High'),
        "BB_Low": safe_get('BB_Low'),
        "ATR": safe_get('ATR'),
        "Volatility": safe_get('Volatility', 4),
        "Volume_Spike": bool(latest.get('Volume_Spike', False))
    }
    
    return indicators

if __name__ == "__main__":
    df = fetch_data("TSLA")
    print(compute_indicators(df))
