import numpy as np

class GlobalLSTM:
    def __init__(self, model_path="models/lstm_global.onnx"):
        self.model_path = model_path
        # Dummy loaded flag
        self.loaded = True

    def predict(self, features_tensor):
        # features_tensor shape: (batch_size, sequence_length, num_features)
        # Dummy prediction for structure
        batch_size = features_tensor.shape[0] if hasattr(features_tensor, "shape") else 1
        return np.random.uniform(0.95, 1.05, size=(batch_size,))
