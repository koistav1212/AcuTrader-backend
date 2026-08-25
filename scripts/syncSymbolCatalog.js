import { PrismaClient } from '@prisma/client';
import YahooFinance from 'yahoo-finance2';

const prisma = new PrismaClient();

async function syncSymbolCatalog() {
  console.log("Starting symbol catalog sync...");

  try {
    const symbolsToSync = [
      'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'TSLA', 'BRK.B', 'AVGO', 'JPM',
      'UNH', 'LLY', 'V', 'XOM', 'JNJ', 'MA', 'PG', 'HD', 'COST', 'ABBV',
      'MRK', 'CRM', 'CVX', 'AMD', 'NFLX', 'PEP', 'KO', 'BAC', 'ADBE', 'TMO',
      'WMT', 'MCD', 'DIS', 'ABT', 'CSCO', 'INTC', 'INTU', 'QCOM', 'TXN', 'IBM'
    ];

    console.log(`Fetching data for ${symbolsToSync.length} symbols...`);

    let newCount = 0;
    let updateCount = 0;

    for (const symbol of symbolsToSync) {
      try {
        const quote = await YahooFinance.quote(symbol);
        if (!quote) continue;

        const exchange = quote.exchange || (quote.exchangeName === 'NasdaqGS' ? 'NASDAQ' : quote.exchangeName);
        if (exchange !== 'NASDAQ' && exchange !== 'NYSE' && exchange !== 'NasdaqGS' && exchange !== 'NMS') {
           continue; 
        }

        const normalizedExchange = (exchange === 'NasdaqGS' || exchange === 'NMS' || exchange === 'NASDAQ') ? 'NASDAQ' : 'NYSE';

        await prisma.symbol_catalog.upsert({
          where: { symbol: quote.symbol },
          update: {
            name: quote.longName || quote.shortName || quote.symbol,
            exchange: normalizedExchange,
            type: quote.quoteType,
            country: 'US', 
            is_active: true,
            updated_at: new Date()
          },
          create: {
            symbol: quote.symbol,
            name: quote.longName || quote.shortName || quote.symbol,
            exchange: normalizedExchange,
            type: quote.quoteType,
            country: 'US',
            is_active: true,
            updated_at: new Date()
          }
        });
        updateCount++;
      } catch (err) {
        console.warn(`Failed to sync ${symbol}: ${err.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`Sync complete. Processed ${updateCount} symbols.`);
  } catch (error) {
    console.error("Error syncing catalog:", error);
  } finally {
    await prisma.$disconnect();
  }
}

syncSymbolCatalog();
