export default class BaseProvider {
  constructor(name) {
    this.name = name;
  }

  async getQuote(symbol) {
    throw new Error(`getQuote not implemented in ${this.name}`);
  }

  async getHistoricalData(symbol, range, interval) {
    throw new Error(`getHistoricalData not implemented in ${this.name}`);
  }

  async search(query) {
    throw new Error(`search not implemented in ${this.name}`);
  }

  async getMovers() {
    throw new Error(`getMovers not implemented in ${this.name}`);
  }

  async getFundamentals(symbol) {
    throw new Error(`getFundamentals not implemented in ${this.name}`);
  }
}
