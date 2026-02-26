def generate_detailed_strategy(technicals, sentiment_data, fundamentals=None):
    """
    Generates a comprehensive trading strategy report including:
    - Technical Analysis Interpretation
    - Scenarios (Conservative vs Swing)
    - Probability Analysis
    - Valuation Check
    """
    price = technicals.get("current_price", 0)
    rsi = technicals.get("RSI", 50)
    macd = technicals.get("MACD", 0)
    macd_signal = technicals.get("MACD_Signal", 0)
    sma_20 = technicals.get("SMA_20", 0)
    sma_50 = technicals.get("SMA_50", 0)
    sma_200 = technicals.get("SMA_200", 0)
    
    
    if price == 0:
        return {
            "entry": "N/A",
            "stop_loss": "N/A",
            "take_profit": "N/A",
            "signal": "Neutral (No Data)",
            "trend_status": "N/A",
            "technical_table": [],
            "scenarios": {},
            "probabilities": {}
        }

    # --- 1. Technical Analysis Interpretation ---
    tech_table = []
    
    # RSI
    rsi_interp = "Neutral"
    if rsi < 30: rsi_interp = "Oversold (Buy Signal)"
    elif rsi < 45: rsi_interp = "Approaching Oversold"
    elif rsi > 70: rsi_interp = "Overbought (Sell Signal)"
    elif rsi > 55: rsi_interp = "Momentum Building"
    tech_table.append({"indicator": "RSI (14-Day)", "reading": f"{rsi:.2f}", "interpretation": rsi_interp})
    
    # MACD
    macd_interp = "Bullish" if macd > macd_signal else "Bearish"
    tech_table.append({"indicator": "MACD", "reading": f"{macd:.2f} / {macd_signal:.2f}", "interpretation": f"{macd_interp} Cross"})
    
    # SMAs
    trend_status = "Uptrend" if price > sma_200 else "Downtrend" 
    short_term_status = "Bullish" if price > sma_20 else "Bearish/Consolidation"
    
    tech_table.append({"indicator": "SMA 200", "reading": f"${sma_200:.2f}", "interpretation": "Long-term Support" if price > sma_200 else "Long-term Resistance"})
    tech_table.append({"indicator": "SMA 20", "reading": f"${sma_20:.2f}", "interpretation": "Immediate Support" if price > sma_20 else "Immediate Resistance"})

    # --- 2. Scenarios ---
    
    # Conservative (Long Term)
    conservative_action = "WAIT / HOLD"
    conservative_reason = "Volatile market conditions."
    target_buy_zone = round(sma_200 * 1.02, 2) # Near 200 DMA
    
    # Fundamental Check for Conservative
    pe_ratio = fundamentals.get("trailingPE", "N/A") if fundamentals else "N/A"
    if isinstance(pe_ratio, (int, float)) and pe_ratio > 60:
         conservative_reason += " Valuation is high (Growth Premium)."
    
    if trend_status == "Uptrend" and rsi < 40:
        conservative_action = "ACCUMULATE"
        conservative_reason = "Long term trend is up and price is pulling back."
    
    # Swing (Short Term)
    swing_signal = "Weak Sell / Avoid"
    swing_setup = {}
    
    if short_term_status == "Bearish/Consolidation":
        swing_signal = "Sell / Avoid"
        # Short setup
        swing_setup = {
            "type": "Bearish",
            "trigger": f"Break below ${round(price * 0.98, 2)}",
            "target": round(price * 0.94, 2),
            "stop_loss": round(price * 1.02, 2)
        }
    elif rsi < 35:
        swing_signal = "Buy Dip"
        swing_setup = {
            "type": "Bullish",
            "trigger": f"Limit Buy at ${round(price, 2)}",
            "target": round(sma_20, 2),
            "stop_loss": round(price * 0.96, 2)
        }
    
    scenarios = {
        "conservative": {
            "action": conservative_action,
            "reason": conservative_reason,
            "entry_zone": f"${target_buy_zone} - ${round(target_buy_zone*1.05, 2)}",
            "target": "18-24 months"
        },
        "swing": {
            "action": swing_signal,
            "setup": swing_setup
        }
    }

    # --- 3. Probability Analysis ---
    # Simple weighted score
    score = 0
    if trend_status == "Uptrend": score += 20
    if macd > macd_signal: score += 20
    if rsi > 40 and rsi < 60: score += 10 # Stable
    elif rsi < 30: score += 15 # Oversold bounce likely
    
    # Sentiment Adjustment
    sent_score = sentiment_data.get("overall_score", 0)
    if sent_score > 0.1: score += 20
    elif sent_score < -0.1: score -= 20
    
    # Determine case probs
    bull_prob = min(max(score, 10), 80) + 10 # Base 10-90
    bear_prob = 100 - bull_prob
    # Split some to neutral
    neutral_prob = 25
    bull_prob = round(bull_prob * 0.75)
    bear_prob = round(bear_prob * 0.75)
    
    probabilities = {
        "bull_case": f"{bull_prob}%",
        "bear_case": f"{bear_prob}%",
        "neutral_case": f"{neutral_prob}%"
    }
    

    # Construct strictly formatted Trade Plan return
    return {
        "entry": scenarios["swing"]["setup"].get("trigger", "Wait"),
        "stop_loss": scenarios["swing"]["setup"].get("stop_loss", "N/A"),
        "take_profit": scenarios["swing"]["setup"].get("target", "N/A"),
        "signal": swing_signal,
        "trend_status": f"{short_term_status} within {trend_status}",
        "technical_table": tech_table,
        "scenarios": scenarios,
        "probabilities": probabilities
    }
