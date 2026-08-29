import BaseProvider from './BaseProvider.js';

export default class FMPProvider extends BaseProvider {
  constructor() {
    super('fmp');
    this.apiKey = process.env.FMP_API_KEY;
  }

  // Placeholder for Financial Modeling Prep
  async getQuote(symbol) {
    return null;
  }
}
