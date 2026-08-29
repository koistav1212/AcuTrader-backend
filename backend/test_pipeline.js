import dotenv from 'dotenv';
dotenv.config();

import marketDataService from './src/modules/market/MarketDataService.js';
import newsService from './src/modules/news/news.service.js';
import forecastService from './src/modules/forecast/forecast.service.js';

async function testPipeline() {
  const symbol = "NVDA";
  console.log(`Testing pipeline for ${symbol}`);
  
  console.log("\n--- 1. Market Data ---");
  const market = await marketDataService.getQuote(symbol);
  console.log(JSON.stringify(market.data, null, 2).slice(0, 500) + '...');
  
  console.log("\n--- 2. Historical Data ---");
  const history = await marketDataService.getHistoricalData(symbol, "1M", "1d");
  console.log(JSON.stringify(history.data, null, 2).slice(0, 200) + '...');
  
  console.log("\n--- 3. News Ingestion (30 days) ---");
  const news = await newsService.getNewsForSymbol(symbol, 30);
  console.log(`Fetched ${news.articles.length} articles`);
  console.log(JSON.stringify(news.articles.slice(0, 5), null, 2));
  
  console.log("\n--- 4. Python ML Forecast ---");
  const forecast = await forecastService.getForecastForSymbol(
    symbol,
    history.data || [],
    news.articles || [],
    {}, // technicals
    {} // fundamentals
  );
  console.log(JSON.stringify(forecast, null, 2));
  
  console.log("\n--- DONE ---");
}

testPipeline().catch(console.error);
