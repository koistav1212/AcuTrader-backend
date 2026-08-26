import numpy as np

def calibrate_probabilities(raw_log_return, current_price, horizon_day=1, volatility=0.02, data_completeness=1.0):
    """
    raw_log_return: expected log return for the specific horizon day (e.g. 0.01 for 1%)
    """
    # Convert log return to price multiplier
    day_multiplier = np.exp(raw_log_return)
    pred_price = current_price * day_multiplier
    
    # Expand variance for targets based on horizon and volatility
    target_variance = volatility * np.sqrt(horizon_day)
    bull_target = pred_price * (1.0 + target_variance)
    bear_target = pred_price * (1.0 - target_variance)
    base_target = pred_price

    # Shift probabilities slightly per day (more uncertainty further out)
    base_prob = 0.50 - (0.05 * horizon_day)
    
    if day_multiplier > 1.0:
        p_bull = 0.40 + (0.02 * horizon_day)
        p_bear = 1.0 - base_prob - p_bull
    else:
        p_bear = 0.40 + (0.02 * horizon_day)
        p_bull = 1.0 - base_prob - p_bear
        
    p_bull = max(0.1, min(p_bull, 0.8))
    p_bear = max(0.1, min(p_bear, 0.8))
    p_base = 1.0 - p_bull - p_bear

    expected_target = (p_bull * bull_target) + (p_base * base_target) + (p_bear * bear_target)
    expected_return = (expected_target - current_price) / current_price if current_price > 0 else 0
    
    # Dynamic confidence based on horizon, volatility, and data completeness
    base_confidence = 0.90
    horizon_penalty = 0.05 * horizon_day
    volatility_penalty = volatility * 2.0
    completeness_penalty = 1.0 - data_completeness
    
    confidence = max(0.1, base_confidence - horizon_penalty - volatility_penalty - completeness_penalty)
    
    return {
        "horizonDay": horizon_day,
        "bull": {
            "probability": round(p_bull, 3),
            "targetPrice": round(bull_target, 2)
        },
        "neutral": {
            "probability": round(p_base, 3),
            "targetPrice": round(base_target, 2)
        },
        "bear": {
            "probability": round(p_bear, 3),
            "targetPrice": round(bear_target, 2)
        },
        "expectedTarget": round(expected_target, 2),
        "expectedReturn": round(expected_return, 4),
        "confidence": round(confidence, 3)
    }
