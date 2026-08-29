const createBaseQuote = () => ({
  symbol: null,
  name: null,
  price: null,
  change: null,
  changePercent: null,
  open: null,
  previousClose: null,
  high: null,
  low: null,
  dayRange: null,
  week52High: null,
  week52Low: null,
  avgVolume: null,
  volume: null,
  bid: null,
  ask: null,
  marketCap: null,
  peRatio: null,
  eps: null,
  dividendYield: null,
  sector: null,
  industry: null,
  enterpriseValue: null,
  forwardPE: null,
  trailingPE: null,
  pegRatio: null,
  priceToSales: null,
  priceToBook: null,
  evToEBITDA: null,
  revenue: null,
  netIncome: null,
  profitMargin: null,
  returnOnEquity: null,
  totalCash: null,
  totalDebt: null,
  debtToEquity: null,
  analystRating: null,
  timestamp: null
});

export const normalizeQuote = (data, provider) => {
  const quote = createBaseQuote();
  if (!data) return quote;

  switch (provider) {
    case 'yahoo':
      quote.symbol = data.symbol || null;
      quote.name = data.shortName || data.longName || null;
      quote.price = data.regularMarketPrice || null;
      quote.change = data.regularMarketChange || null;
      quote.changePercent = data.regularMarketChangePercent || null;
      quote.volume = data.regularMarketVolume || null;
      quote.avgVolume = data.averageDailyVolume10Day || data.averageDailyVolume3Month || null;
      quote.high = data.regularMarketDayHigh || null;
      quote.low = data.regularMarketDayLow || null;
      quote.open = data.regularMarketOpen || null;
      quote.previousClose = data.regularMarketPreviousClose || null;
      quote.bid = data.bid || null;
      quote.ask = data.ask || null;
      quote.week52High = data.fiftyTwoWeekHigh || null;
      quote.week52Low = data.fiftyTwoWeekLow || null;
      quote.marketCap = data.marketCap || null;
      quote.peRatio = data.trailingPE || data.forwardPE || null;
      quote.trailingPE = data.trailingPE || null;
      quote.forwardPE = data.forwardPE || null;
      quote.eps = data.epsTrailingTwelveMonths || data.epsForward || null;
      quote.dividendYield = data.trailingAnnualDividendYield || data.dividendYield || null;
      quote.priceToBook = data.priceToBook || null;
      quote.timestamp = data.regularMarketTime ? new Date(data.regularMarketTime).toISOString() : new Date().toISOString();
      break;

    case 'alphavantage':
      const aq = data['Global Quote'];
      if (!aq) return quote;
      quote.symbol = aq['01. symbol'] || null;
      quote.price = aq['05. price'] ? parseFloat(aq['05. price']) : null;
      quote.change = aq['09. change'] ? parseFloat(aq['09. change']) : null;
      quote.changePercent = aq['10. change percent'] ? parseFloat(aq['10. change percent'].replace('%', '')) : null;
      quote.volume = aq['06. volume'] ? parseInt(aq['06. volume'], 10) : null;
      quote.high = aq['03. high'] ? parseFloat(aq['03. high']) : null;
      quote.low = aq['04. low'] ? parseFloat(aq['04. low']) : null;
      quote.open = aq['02. open'] ? parseFloat(aq['02. open']) : null;
      quote.previousClose = aq['08. previous close'] ? parseFloat(aq['08. previous close']) : null;
      quote.timestamp = new Date().toISOString();
      break;

    case 'finnhub':
      quote.symbol = data.symbol || null;
      quote.price = data.c !== undefined ? data.c : null;
      quote.change = data.d !== undefined ? data.d : null;
      quote.changePercent = data.dp !== undefined ? data.dp : null;
      quote.high = data.h !== undefined ? data.h : null;
      quote.low = data.l !== undefined ? data.l : null;
      quote.open = data.o !== undefined ? data.o : null;
      quote.previousClose = data.pc !== undefined ? data.pc : null;
      quote.timestamp = new Date().toISOString();
      break;
      
    case 'twelvedata':
      quote.symbol = data.symbol || null;
      quote.name = data.name || null;
      quote.price = data.close !== undefined ? parseFloat(data.close) : (data.price !== undefined ? parseFloat(data.price) : null);
      quote.change = data.change !== undefined ? parseFloat(data.change) : null;
      quote.changePercent = data.percent_change !== undefined ? parseFloat(data.percent_change) : null;
      quote.volume = data.volume !== undefined ? parseInt(data.volume, 10) : null;
      quote.high = data.high !== undefined ? parseFloat(data.high) : null;
      quote.low = data.low !== undefined ? parseFloat(data.low) : null;
      quote.open = data.open !== undefined ? parseFloat(data.open) : null;
      quote.previousClose = data.previous_close !== undefined ? parseFloat(data.previous_close) : null;
      if (data.fifty_two_week) {
        quote.week52High = data.fifty_two_week.high !== undefined ? parseFloat(data.fifty_two_week.high) : null;
        quote.week52Low = data.fifty_two_week.low !== undefined ? parseFloat(data.fifty_two_week.low) : null;
      }
      quote.timestamp = data.timestamp ? new Date(data.timestamp * 1000).toISOString() : new Date().toISOString();
      break;

    default:
      Object.keys(quote).forEach(key => {
        if (data[key] !== undefined) quote[key] = data[key];
      });
      break;
  }

  if (quote.dayRange === null && quote.low !== null && quote.high !== null) {
    quote.dayRange = `${quote.low} - ${quote.high}`;
  }
  if (quote.week52High !== null && quote.week52Low !== null) {
    quote['52WeekRange'] = `${quote.week52Low} - ${quote.week52High}`;
  }

  return quote;
};

export const normalizeHistory = (data, provider) => {
  switch (provider) {
    case 'yahoo':
      return data.map(candle => ({
        date: candle.date.toISOString(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        adjClose: candle.adjClose || candle.close,
        volume: candle.volume
      }));
    case 'alphavantage':
      // Requires parsing time series dict
      const timeSeriesKey = Object.keys(data).find(k => k.includes('Time Series'));
      if (!timeSeriesKey) return [];
      const timeSeries = data[timeSeriesKey];
      return Object.entries(timeSeries).map(([dateStr, candle]) => ({
        date: new Date(dateStr).toISOString(),
        open: parseFloat(candle['1. open']),
        high: parseFloat(candle['2. high']),
        low: parseFloat(candle['3. low']),
        close: parseFloat(candle['4. close']),
        adjClose: parseFloat(candle['5. adjusted close'] || candle['4. close']),
        volume: parseInt(candle['6. volume'] || candle['5. volume'], 10)
      })).sort((a, b) => new Date(a.date) - new Date(b.date));
    default:
      return data;
  }
};
