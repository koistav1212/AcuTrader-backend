import os
import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier

class MultimodalFusion:
    """
    Fuses the predictions of the baseline quantitative models (XGBoost + Ridge)
    with the temporal news encoding (LSTM output) to produce calibrated
    Bull / Neutral / Bear probabilities.
    """
    def __init__(self, model_dir="models", horizon=3):
        self.model_dir = model_dir
        self.horizon = horizon
        self.models = {} # One fusion model per horizon day
        self.loaded = False
        os.makedirs(self.model_dir, exist_ok=True)
        
    def _get_model_path(self, day):
        return os.path.join(self.model_dir, f"multimodal_fusion_d{day}.joblib")
        
    def load(self):
        try:
            for day in range(1, self.horizon + 1):
                path = self._get_model_path(day)
                if os.path.exists(path):
                    self.models[day] = joblib.load(path)
            
            if len(self.models) == self.horizon:
                self.loaded = True
                return True
        except Exception as e:
            print(f"Failed to load MultimodalFusion: {e}")
        return False
        
    def save(self):
        for day, model in self.models.items():
            joblib.dump(model, self._get_model_path(day))
            
    def _categorize_return(self, ret):
        """
        Categorizes a continuous return into:
        0: Bear (<= -1%)
        1: Neutral (-1% < x < +1%)
        2: Bull (>= +1%)
        """
        threshold = 0.01 # 1%
        if ret <= -threshold:
            return 0
        elif ret >= threshold:
            return 2
        else:
            return 1
            
    def train(self, local_preds, global_preds, news_encodings, y_returns):
        """
        local_preds: dict of {day: np.array of predictions}
        global_preds: dict of {day: np.array of predictions}
        news_encodings: np.array (N, 16)
        y_returns: dict of {day: np.array of true returns}
        """
        for day in range(1, self.horizon + 1):
            X_fusion = np.hstack([
                local_preds[day].reshape(-1, 1),
                global_preds[day].reshape(-1, 1),
                news_encodings
            ])
            
            y_cat = np.array([self._categorize_return(r) for r in y_returns[day]])
            
            # Using LogisticRegression as a robust meta-learner
            model = LogisticRegression(max_iter=1000, class_weight='balanced')
            
            # Fallback if only one class is present in training data
            if len(np.unique(y_cat)) > 1:
                model.fit(X_fusion, y_cat)
            else:
                # Mock a multi-class model fit if data is purely 1 class (rare but possible in small tests)
                # To prevent crashing during predict_proba
                dummy_X = np.vstack([X_fusion, np.zeros((3, X_fusion.shape[1]))])
                dummy_y = np.append(y_cat, [0, 1, 2])
                model.fit(dummy_X, dummy_y)
                
            self.models[day] = model
            
        self.loaded = True
        self.save()
        
    def predict_probabilities(self, local_pred, global_pred, news_encoding):
        """
        Takes a single row of predictions and the 16-d news encoding.
        local_pred: (horizon,) array
        global_pred: (horizon,) array
        news_encoding: (16,) array
        
        Returns a list of dicts for each horizon day:
        [{"bull": 0.4, "neutral": 0.4, "bear": 0.2}, ...]
        """
        if not self.loaded:
            # Fallback probabilities
            return [{"bull": 0.33, "neutral": 0.34, "bear": 0.33} for _ in range(self.horizon)]
            
        probs = []
        for day in range(1, self.horizon + 1):
            day_local = local_pred[day - 1]
            day_global = global_pred[day - 1]
            
            x_fusion = np.hstack([[day_local], [day_global], news_encoding]).reshape(1, -1)
            
            model = self.models[day]
            pred_proba = model.predict_proba(x_fusion)[0]
            
            # Ensure proper mapping based on classes_
            prob_dict = {"bear": 0.0, "neutral": 0.0, "bull": 0.0}
            for cls_idx, cls_label in enumerate(model.classes_):
                if cls_label == 0: prob_dict["bear"] = float(pred_proba[cls_idx])
                elif cls_label == 1: prob_dict["neutral"] = float(pred_proba[cls_idx])
                elif cls_label == 2: prob_dict["bull"] = float(pred_proba[cls_idx])
                
            # Normalize just in case
            total = sum(prob_dict.values())
            if total > 0:
                prob_dict = {k: v / total for k, v in prob_dict.items()}
            else:
                prob_dict = {"bull": 0.33, "neutral": 0.34, "bear": 0.33}
                
            probs.append(prob_dict)
            
        return probs
