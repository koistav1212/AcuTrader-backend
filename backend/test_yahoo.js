import marketDataService from './src/modules/market/MarketDataService.js';
async function test() {
  const data = await marketDataService.getHistoricalData('SPY', '10Y', '1d');
  console.log('Total candles:', data?.data?.length);
  if(data?.data?.length > 0) {
     console.log('First date:', data.data[0].date);
     console.log('Last date:', data.data[data.data.length - 1].date);
  }
}
test();
