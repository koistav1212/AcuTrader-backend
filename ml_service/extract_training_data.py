import os
import requests
import pandas as pd
import numpy as np

def build_features_df(ohlcv_list):
    """ Converts OHLCV into a pandas dataframe with standard features """
    if not ohlcv_list:
        return pd.DataFrame()
        
    df = pd.DataFrame(ohlcv_list)
    # Ensure correct column names
    col_map = {c: c.lower() for c in df.columns}
    df = df.rename(columns=col_map)
    
    if 'datetime' in df.columns:
        df['datetime'] = pd.to_datetime(df['datetime'])
        df.set_index('datetime', inplace=True)
    elif 'date' in df.columns:
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)
        
    df.sort_index(inplace=True)
    
    # Calculate base features
    df['returns'] = df['close'].pct_change()
    df['volatility_20'] = df['returns'].rolling(20).std()
    df['sma_20'] = df['close'].rolling(20).mean()
    df['sma_50'] = df['close'].rolling(50).mean()
    df['momentum_10'] = df['close'].pct_change(10)
    
    # Drop NaNs from rolling
    df = df.dropna()
    return df

def extract_data():
    symbol = "NVDA"
    horizon = 3
    print(f"Fetching market history for {symbol}...")
    
    # Fetch data
    res = requests.get(f"http://localhost:4000/api/market/history/{symbol}?range=max&interval=1d")
    data = res.json()
    ohlcv = data.get('data', [])
    
    if not ohlcv:
        print("Failed to fetch OHLCV data.")
        return
        
    df = build_features_df(ohlcv)
    print(f"Built features dataframe with {len(df)} valid rows.")
    
    y = {}
    for day in range(1, horizon + 1):
        y[day] = np.log(df['close'].shift(-day) / df['close'])
        
    valid_idx = df.index[:-horizon]
    
    feature_cols = ['returns', 'volatility_20', 'sma_20', 'sma_50', 'momentum_10', 'volume']
    feature_cols = [c for c in feature_cols if c in df.columns]
    
    X = df.loc[valid_idx, feature_cols]
    
    # Create the output directory
    output_dir = "training_data_final_set"
    os.makedirs(output_dir, exist_ok=True)
    
    # Save quantitative features
    X.to_csv(os.path.join(output_dir, f"{symbol}_X_features.csv"))
    
    # Save target variables
    y_df = pd.DataFrame({f"target_day_{day}": y[day].loc[valid_idx] for day in range(1, horizon + 1)})
    y_df.to_csv(os.path.join(output_dir, f"{symbol}_y_targets.csv"))
    
    try:
        news_res = requests.get(f"http://localhost:4000/api/market/news/{symbol}")
        if news_res.status_code == 200:
            news_data = news_res.json()
            news_articles = news_data if isinstance(news_data, list) else news_data.get('data', [])
        else:
            news_articles = []
            print(f"News endpoint returned {news_res.status_code}")
    except Exception as e:
        print(f"Failed to fetch news: {e}")
        news_articles = []
    
    if news_articles:
        news_df = pd.DataFrame(news_articles)
        news_df.to_csv(os.path.join(output_dir, f"{symbol}_news_features.csv"), index=False)
    else:
        print("No news articles saved.")
        
    print(f"Successfully extracted training and testing datasets to directory: {output_dir}/")

if __name__ == "__main__":
    extract_data()
