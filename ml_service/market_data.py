import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime

RANGE_MAP = {
    "1D": "1d",
    "5D": "5d",
    "1M": "1mo",
    "3M": "3mo",
    "6M": "6mo",
    "1Y": "1y",
    "2Y": "2y",
    "5Y": "5y",
    "10Y": "10y",
    "YTD": "ytd",
    "MAX": "max"
}

def sanitize_symbol(symbol: str) -> str:
    return symbol.upper().strip()

def resolve_range(range_str: str) -> str:
    range_upper = range_str.upper()
    return RANGE_MAP.get(range_upper, "1mo")

def resolve_interval(range_str: str, requested_interval: str) -> str:
    range_upper = range_str.upper()
    
    long_ranges = ["1M", "3M", "6M", "1Y", "2Y", "5Y", "10Y", "YTD", "MAX"]
    if range_upper in long_ranges:
        return "1d"
    
    if range_upper == "1D":
        if requested_interval in ["1m", "2m", "5m", "10m", "15m", "30m", "1h"]:
            return requested_interval
        return "5m"
        
    if range_upper == "5D":
        if requested_interval in ["5m", "10m", "15m", "30m", "1h", "1d"]:
            return requested_interval
        return "15m"

    return "1d"

def fetch_history(symbol: str, requested_range: str, requested_interval: str):
    normalized_symbol = sanitize_symbol(symbol)
    resolved_range = resolve_range(requested_range)
    
    resolved_interval = resolve_interval(requested_range, requested_interval)
    source_interval = resolved_interval

    if requested_interval == "10m" and resolved_interval == "10m":
        source_interval = "5m"

    try:
        ticker = yf.Ticker(normalized_symbol)
        data = ticker.history(
            period=resolved_range,
            interval=source_interval,
            auto_adjust=False,
            prepost=False
        )
    except Exception as e:
        return {"success": False, "data": [], "error": f"yfinance error: {str(e)}"}

    if data is None or data.empty:
        return {"success": False, "data": [], "error": "No historical data returned"}

    # Handle timezone and ensure index is datetime
    if not isinstance(data.index, pd.DatetimeIndex):
        data.index = pd.to_datetime(data.index, utc=True)
    elif data.index.tz is not None:
        data.index = data.index.tz_convert("UTC")
    else:
        data.index = data.index.tz_localize("UTC")

    # Resample 5m to 10m if requested
    if requested_interval == "10m" and source_interval == "5m":
        data = data.resample("10min").agg({
            "Open": "first",
            "High": "max",
            "Low": "min",
            "Close": "last",
            "Volume": "sum"
        }).dropna()
        
    if data.empty:
        return {"success": False, "data": [], "error": "No historical data after resampling"}

    # Convert to list of dictionaries
    candles = []
    for timestamp, row in data.iterrows():
        # Ensure we skip completely null rows
        if pd.isna(row['Open']) or pd.isna(row['High']) or pd.isna(row['Low']) or pd.isna(row['Close']):
            continue
            
        candles.append({
            "timestamp": timestamp.isoformat(),
            "open": float(row['Open']),
            "high": float(row['High']),
            "low": float(row['Low']),
            "close": float(row['Close']),
            "volume": int(row['Volume']) if not pd.isna(row['Volume']) else 0
        })

    if not candles:
        return {"success": False, "data": [], "error": "No valid OHLCV candles parsed"}

    return {
        "success": True,
        "data": candles,
        "meta": {
            "symbol": normalized_symbol,
            "requestedRange": requested_range,
            "requestedInterval": requested_interval,
            "sourceInterval": source_interval,
            "resolvedInterval": resolved_interval,
            "source": "yfinance",
            "dataPoints": len(candles),
            "lastDataTimestamp": candles[-1]["timestamp"] if candles else None,
            "fetchedAt": datetime.utcnow().isoformat() + "Z"
        }
    }
