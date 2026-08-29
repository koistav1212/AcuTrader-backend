import os
import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np

class TemporalNewsLSTM(nn.Module):
    def __init__(self, input_size=389, hidden_size=64, num_layers=1, output_size=16):
        super(TemporalNewsLSTM, self).__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, output_size)
        
    def forward(self, x):
        # x is (batch, seq, features)
        out, (hn, cn) = self.lstm(x)
        last_out = out[:, -1, :] # state of the last sequence step
        encoded = self.fc(last_out)
        return encoded

class NewsLSTMEncoder:
    """
    Wraps the PyTorch LSTM to manage loading, saving, and inference.
    """
    def __init__(self, model_dir="models", input_size=389, horizon=3):
        self.model_dir = model_dir
        self.input_size = input_size
        self.horizon = horizon
        self.model = TemporalNewsLSTM(input_size=input_size)
        self.model_path = os.path.join(model_dir, "temporal_news_lstm.pth")
        self.loaded = False
        os.makedirs(self.model_dir, exist_ok=True)
        
    def load(self):
        if os.path.exists(self.model_path):
            try:
                self.model.load_state_dict(torch.load(self.model_path, weights_only=True))
                self.model.eval()
                self.loaded = True
                return True
            except Exception as e:
                print(f"Failed to load TemporalNewsLSTM: {e}")
        return False
        
    def save(self):
        torch.save(self.model.state_dict(), self.model_path)
        
    def train(self, X_news_seq, y_returns):
        """
        Simple pre-training loop for the LSTM.
        X_news_seq: (N, seq_len, 389)
        y_returns: (N, horizon)
        """
        if len(X_news_seq) == 0:
            return
            
        # Add a temporary projection layer for pre-training to predict returns
        class PretrainWrapper(nn.Module):
            def __init__(self, encoder, horizon):
                super().__init__()
                self.encoder = encoder
                self.head = nn.Linear(16, horizon)
            def forward(self, x):
                enc = self.encoder(x)
                return self.head(enc)
                
        wrapper = PretrainWrapper(self.model, self.horizon)
        criterion = nn.MSELoss()
        optimizer = optim.Adam(wrapper.parameters(), lr=0.01)
        
        X_tensor = torch.tensor(X_news_seq, dtype=torch.float32)
        y_tensor = torch.tensor(y_returns, dtype=torch.float32)
        
        wrapper.train()
        epochs = 20
        for epoch in range(epochs):
            optimizer.zero_grad()
            outputs = wrapper(X_tensor)
            loss = criterion(outputs, y_tensor)
            loss.backward()
            optimizer.step()
            
        self.model.eval()
        self.loaded = True
        self.save()
        
    def encode(self, x_seq):
        """
        x_seq: (seq_len, 389)
        Returns: (16,)
        """
        if len(x_seq) == 0:
            # Fallback for no news
            return np.zeros(16)
            
        if not self.loaded:
            self.model.eval()
            
        with torch.no_grad():
            x_tensor = torch.tensor(x_seq, dtype=torch.float32).unsqueeze(0)
            encoded = self.model(x_tensor)
            return encoded.squeeze(0).numpy()
