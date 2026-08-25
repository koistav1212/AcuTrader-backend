import numpy as np

def calibrate_probabilities(raw_prediction, current_price):
    # raw_prediction is expected multiplier, e.g., 1.04 means 4% gain
    pred_price = current_price * raw_prediction[0] if isinstance(raw_prediction, np.ndarray) else current_price * raw_prediction
    
    # Generate scenarios
    bull_target = pred_price * 1.05
    bear_target = pred_price * 0.92
    base_target = pred_price

    # Dummy probabilities (ensure they sum to 1)
    p_bull = 0.58
    p_base = 0.30
    p_bear = 0.12

    expected_target = (p_bull * bull_target) + (p_base * base_target) + (p_bear * bear_target)
    expected_return = (expected_target - current_price) / current_price if current_price > 0 else 0
    
    return {
        "scenarios": {
            "bull": {
                "probability": p_bull,
                "targetPrice": round(bull_target, 2)
            },
            "base": {
                "probability": p_base,
                "targetPrice": round(base_target, 2)
            },
            "bear": {
                "probability": p_bear,
                "targetPrice": round(bear_target, 2)
            }
        },
        "expectedTarget": round(expected_target, 2),
        "expectedReturn": round(expected_return, 4),
        "confidence": 0.81
    }
