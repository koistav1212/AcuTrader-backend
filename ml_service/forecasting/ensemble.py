import numpy as np
from .lstm import GlobalLSTM
from .transformer import TimeSeriesTransformer

class EnsembleForecaster:
    def __init__(self):
        self.lstm = GlobalLSTM()
        self.transformer = TimeSeriesTransformer()

    def predict(self, features_tensor):
        lstm_pred = self.lstm.predict(features_tensor)
        transformer_pred = self.transformer.predict(features_tensor)
        
        # Simple average ensemble
        ensemble_pred = (lstm_pred + transformer_pred) / 2.0
        return ensemble_pred
