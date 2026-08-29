import marketDataService from './MarketDataService.js';

class MarketStreamService {
  constructor() {
    this.clients = new Set();
    this.pollingInterval = null;
    this.subscribedSymbols = new Set();
  }

  addClient(res) {
    this.clients.add(res);
    res.on('close', () => {
      this.clients.delete(res);
      if (this.clients.size === 0) {
        this.stopPolling();
      }
    });

    if (this.clients.size === 1 && this.subscribedSymbols.size > 0) {
      this.startPolling();
    }
  }

  subscribe(symbol) {
    this.subscribedSymbols.add(symbol);
    if (this.clients.size > 0) {
      this.startPolling();
    }
  }

  unsubscribe(symbol) {
    this.subscribedSymbols.delete(symbol);
    if (this.subscribedSymbols.size === 0) {
      this.stopPolling();
    }
  }

  broadcast(data) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      client.write(payload);
    }
  }

  startPolling() {
    if (this.pollingInterval) return;
    
    // Poll every 10 seconds for subscribed symbols
    this.pollingInterval = setInterval(async () => {
      for (const symbol of this.subscribedSymbols) {
        try {
          const result = await marketDataService.getQuote(symbol);
          if (result && result.data) {
            this.broadcast({ type: 'quote', symbol, data: result.data });
          }
        } catch (error) {
          console.error(`[MarketStreamService] Error polling ${symbol}:`, error.message);
        }
      }
    }, 10000);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}

export default new MarketStreamService();
