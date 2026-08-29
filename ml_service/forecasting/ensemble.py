import numpy as np
import os
from .local_dynamics import LocalDynamicsModel
from .global_dynamics import GlobalDynamicsModel
from .temporal_news_encoder import NewsLSTMEncoder
from .multimodal_fusion import MultimodalFusion

class EnsembleForecaster:
    def __init__(self, model_dir="models", horizon=3):
        self.model_dir = model_dir
        self.horizon = horizon
        self.local_model = LocalDynamicsModel(model_dir=self.model_dir, horizon=self.horizon)
        self.global_model = GlobalDynamicsModel(model_dir=self.model_dir, horizon=self.horizon)
        
        # New Multimodal additions
        self.news_encoder = NewsLSTMEncoder(model_dir=self.model_dir, horizon=self.horizon)
        self.fusion_model = MultimodalFusion(model_dir=self.model_dir, horizon=self.horizon)
        
        self.loaded = False

    def load(self):
        # Attempt to load all models
        local_loaded = self.local_model.load()
        global_loaded = self.global_model.load()
        news_loaded = self.news_encoder.load()
        fusion_loaded = self.fusion_model.load()
        
        self.loaded = local_loaded and global_loaded and news_loaded and fusion_loaded
        return self.loaded

    def train(self, X_train, y_train, X_news_seq=None):
        print("Training Local Dynamics Model (XGBoost)...")
        self.local_model.train(X_train, y_train)
        
        print("Training Global Dynamics Model (Ridge)...")
        self.global_model.train(X_train, y_train)
        
        # Train LSTM Encoder if news data is provided
        if X_news_seq is not None and len(X_news_seq) > 0:
            print("Pre-training Temporal News Encoder (LSTM)...")
            # We assume y_train values are a dict, let's use day 1 returns for pretraining
            # or flatten them. For simplicity, we just train on day 1 if available
            y_pretrain = y_train[1] if 1 in y_train else np.zeros((len(X_news_seq), 1))
            self.news_encoder.train(X_news_seq, y_pretrain)
            
        print("Training Multimodal Fusion Model...")
        # Get predictions on training set to train fusion
        # Note: In a rigorous setup, we should use cross-validation predictions here 
        # to avoid overfitting the fusion model. We use raw train preds for simplicity here.
        local_preds = {}
        global_preds = {}
        for day in range(1, self.horizon + 1):
            if day in self.local_model.models:
                local_preds[day] = self.local_model.models[day].predict(X_train)
            else:
                local_preds[day] = np.zeros(len(X_train))
                
            if day in self.global_model.models:
                global_preds[day] = self.global_model.models[day].predict(X_train)
            else:
                global_preds[day] = np.zeros(len(X_train))
                
        # Generate encodings for fusion
        if X_news_seq is not None and len(X_news_seq) > 0:
            news_encodings = np.array([self.news_encoder.encode(seq) for seq in X_news_seq])
        else:
            news_encodings = np.zeros((len(X_train), 16))
            
        self.fusion_model.train(local_preds, global_preds, news_encodings, y_train)
        
        self.loaded = True

    def predict(self, features_df, news_seq=None):
        """
        features_df: pd.DataFrame with 1 row (quantitative features)
        news_seq: np.array (seq_len, 389) or None
        
        Returns:
            ensemble_pred: Continuous return predictions (horizon,)
            probabilities: List of dictionaries with bull/neutral/bear probabilities
            news_encoding: The 16d vector representing the news impact
        """
        local_pred = self.local_model.predict(features_df)
        global_pred = self.global_model.predict(features_df)
        
        # Simple average ensemble for the continuous return
        ensemble_pred = (local_pred + global_pred) / 2.0
        
        # News encoding
        if news_seq is not None and len(news_seq) > 0:
            news_encoding = self.news_encoder.encode(news_seq)
        else:
            news_encoding = np.zeros(16)
            
        # Multimodal fusion for probabilities
        probabilities = self.fusion_model.predict_probabilities(local_pred, global_pred, news_encoding)
        
        return ensemble_pred, probabilities, news_encoding
