import os
import joblib
import xgboost as xgb
import pandas as pd
import numpy as np

class LocalDynamicsModel:
    """
    XGBoost-based model for sequential local dynamics (short-to-medium term patterns).
    Predicts future returns rather than raw prices.
    """
    def __init__(self, model_dir="models", horizon=3):
        self.model_dir = model_dir
        self.horizon = horizon
        self.models = {}  # One model per day ahead, e.g. {1: model_d1, 2: model_d2, 3: model_d3}
        self.loaded = False
        os.makedirs(self.model_dir, exist_ok=True)

    def _get_model_path(self, day):
        return os.path.join(self.model_dir, f"xgboost_local_d{day}.joblib")

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
            print(f"Failed to load LocalDynamics models: {e}")
        return False

    def save(self):
        for day, model in self.models.items():
            joblib.dump(model, self._get_model_path(day))

    def train(self, X_train, y_train):
        """
        X_train: pd.DataFrame of features
        y_train: dict of {1: Series, 2: Series, 3: Series} mapping day ahead to return series
        """
        for day in range(1, self.horizon + 1):
            model = xgb.XGBRegressor(
                n_estimators=100,
                max_depth=4,
                learning_rate=0.05,
                objective='reg:squarederror'
            )
            model.fit(X_train, y_train[day])
            self.models[day] = model
        
        self.loaded = True
        self.save()

    def predict(self, features_df):
        """
        features_df: single row DataFrame for prediction
        Returns array of predicted returns [ret_d1, ret_d2, ret_d3]
        """
        if not self.loaded:
            # Fallback to zeros if not trained (e.g. 0% expected return)
            return np.zeros(self.horizon)
            
        predictions = []
        for day in range(1, self.horizon + 1):
            if day in self.models:
                pred = self.models[day].predict(features_df)[0]
                predictions.append(pred)
            else:
                predictions.append(0.0)
                
        return np.array(predictions)
