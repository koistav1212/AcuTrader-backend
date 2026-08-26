import numpy as np
import os
from .local_dynamics import LocalDynamicsModel
from .global_dynamics import GlobalDynamicsModel

class EnsembleForecaster:
    def __init__(self, model_dir="models", horizon=3):
        self.model_dir = model_dir
        self.horizon = horizon
        self.local_model = LocalDynamicsModel(model_dir=self.model_dir, horizon=self.horizon)
        self.global_model = GlobalDynamicsModel(model_dir=self.model_dir, horizon=self.horizon)
        self.loaded = False

    def load(self):
        # Attempt to load both models
        local_loaded = self.local_model.load()
        global_loaded = self.global_model.load()
        self.loaded = local_loaded and global_loaded
        return self.loaded

    def train(self, X_train, y_train):
        print("Training Local Dynamics Model (XGBoost)...")
        self.local_model.train(X_train, y_train)
        
        print("Training Global Dynamics Model (Ridge)...")
        self.global_model.train(X_train, y_train)
        
        self.loaded = True

    def predict(self, features_df):
        """
        features_df: pd.DataFrame with 1 row
        Returns: numpy array of shape (horizon,) containing log return predictions
        """
        local_pred = self.local_model.predict(features_df)
        global_pred = self.global_model.predict(features_df)
        
        # Simple average ensemble
        ensemble_pred = (local_pred + global_pred) / 2.0
        return ensemble_pred
