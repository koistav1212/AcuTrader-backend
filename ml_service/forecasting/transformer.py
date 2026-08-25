import numpy as np

class TimeSeriesTransformer:
    def __init__(self):
        self.loaded = True

    def predict(self, features_tensor):
        batch_size = features_tensor.shape[0] if hasattr(features_tensor, "shape") else 1
        return np.random.uniform(0.95, 1.05, size=(batch_size,))
