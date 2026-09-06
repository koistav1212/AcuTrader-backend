import pandas as pd
import numpy as np
from datetime import timedelta

def compute_market_features(ohlcv_list, training=False):
    """
    Constructs the canonical market feature dataset and strictly enforces a 5-year rolling training window.
    """
    if not ohlcv_list:
        return pd.DataFrame()
        
    df = pd.DataFrame(ohlcv_list)
    col_map = {c: c.lower() for c in df.columns}
    df = df.rename(columns=col_map)
    
    # Ensure correct datetime index
    if 'datetime' in df.columns:
        df['datetime'] = pd.to_datetime(df['datetime'])
        df.set_index('datetime', inplace=True)
    elif 'date' in df.columns:
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)
        
    df.sort_index(inplace=True)
    
    if len(df) == 0:
        return df

    # IDENTIFICATION / TIME
    df['day_of_week'] = df.index.dayofweek
    df['month'] = df.index.month
    df['quarter'] = df.index.quarter

    # PRICE / OHLC (Assuming open, high, low, close, volume exist)
    # RETURNS
    df['return_1d'] = df['close'].pct_change(1)
    df['return_3d'] = df['close'].pct_change(3)
    df['return_5d'] = df['close'].pct_change(5)
    df['return_10d'] = df['close'].pct_change(10)
    df['return_20d'] = df['close'].pct_change(20)
    df['log_return_1d'] = np.log(df['close'] / df['close'].shift(1))

    # CUMULATIVE RETURNS
    df['cumulative_return_5d'] = (1 + df['return_1d']).rolling(5).apply(np.prod, raw=True) - 1
    df['cumulative_return_20d'] = (1 + df['return_1d']).rolling(20).apply(np.prod, raw=True) - 1

    # VOLATILITY
    df['volatility_5'] = df['return_1d'].rolling(5).std()
    df['volatility_10'] = df['return_1d'].rolling(10).std()
    df['volatility_20'] = df['return_1d'].rolling(20).std()
    df['volatility_60'] = df['return_1d'].rolling(60).std()

    # ATR (Average True Range)
    high_low = df['high'] - df['low']
    high_close = np.abs(df['high'] - df['close'].shift())
    low_close = np.abs(df['low'] - df['close'].shift())
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = np.max(ranges, axis=1)
    df['ATR_14'] = true_range.rolling(14).mean()
    df['ATR_percent'] = df['ATR_14'] / df['close']

    # MOVING AVERAGES / TREND
    df['SMA_20'] = df['close'].rolling(20).mean()
    df['SMA_50'] = df['close'].rolling(50).mean()
    df['EMA_12'] = df['close'].ewm(span=12, adjust=False).mean()
    df['EMA_26'] = df['close'].ewm(span=26, adjust=False).mean()
    df['MACD'] = df['EMA_12'] - df['EMA_26']

    # RSI 14
    delta = df['close'].diff()
    up = delta.clip(lower=0)
    down = -1 * delta.clip(upper=0)
    ema_up = up.ewm(com=13, adjust=False).mean()
    ema_down = down.ewm(com=13, adjust=False).mean()
    rs = ema_up / ema_down
    df['RSI_14'] = 100 - (100 / (1 + rs))

    # ENFORCE TRAINING WINDOW (Phase 2)
    # We drop NAs first to ensure features are valid
    df = df.dropna()

    if len(df) == 0:
        return df

    # Rolling 5-year window from the latest trading date available
    latest_trading_date = df.index[-1]
    
    if training:
        # For training, we want exactly the last 5 years from the latest date
        # DateOffset is accurate for leap years, but timedelta(days=365*5) is a safe approx without pandas date offsets errors
        training_start = latest_trading_date - pd.DateOffset(years=5)
        # Filter dataframe strictly to this 5-year window
        df = df.loc[training_start:latest_trading_date].copy()
        
    return df

def generate_targets(df, horizon=3):
    """
    Explicitly defines target_return_1d, 2d, 3d using future trading observations. (Phase 3)
    Returns dictionary of y targets.
    """
    y = {}
    for day in range(1, horizon + 1):
        y[day] = (df['close'].shift(-day) / df['close']) - 1.0
        
    return y
