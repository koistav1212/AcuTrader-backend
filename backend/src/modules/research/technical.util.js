export function computeTechnicals(history = []) {
  if (!history || history.length < 2) return {};

  const closes = history.map(d => d.close || d.Close || 0);
  const highs = history.map(d => d.high || d.High || 0);
  const lows = history.map(d => d.low || d.Low || 0);
  const volumes = history.map(d => d.volume || d.Volume || 0);

  const currentPrice = closes[closes.length - 1];

  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);

  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);

  const rsi14 = calculateRSI(closes, 14);
  const macd = calculateMACD(closes, 12, 26, 9);
  const bb = calculateBollingerBands(closes, 20, 2);
  const atr14 = calculateATR(highs, lows, closes, 14);

  const returns = calculateReturns(closes);
  const volatility = calculateVolatility(returns, 20);
  const momentum = closes.length >= 14 ? (currentPrice - closes[closes.length - 14]) / closes[closes.length - 14] : null;
  
  const avgVolume20 = calculateSMA(volumes, 20);
  const volumeRatio = avgVolume20 ? volumes[volumes.length - 1] / avgVolume20 : null;

  return {
    currentPrice,
    sma20,
    sma50,
    sma200,
    ema9,
    ema21,
    rsi14,
    macd,
    bollingerBands: bb,
    atr14,
    volatility,
    momentum,
    volumeRatio
  };
}

export function computeWeeklyContext(dailyHistory = []) {
  if (!dailyHistory || dailyHistory.length === 0) return [];

  // Group by week ending date (Friday)
  const weeks = {};
  for (const day of dailyHistory) {
    const d = new Date(day.date || day.datetime);
    if (isNaN(d.getTime())) continue;

    // Get Friday of this week
    const dayOfWeek = d.getDay();
    // JS getDay: 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    // Offset to next Friday:
    const daysToFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 6; 
    const friday = new Date(d);
    friday.setDate(d.getDate() + daysToFriday);
    friday.setHours(0, 0, 0, 0);
    const key = friday.toISOString().split('T')[0];

    if (!weeks[key]) {
      weeks[key] = {
        weekEnding: key,
        open: day.open || day.close,
        high: day.high || day.close,
        low: day.low || day.close,
        close: day.close,
        volume: day.volume || 0,
        days: 1,
        date: key // used for indicators
      };
    } else {
      const w = weeks[key];
      // Keep earliest open (assuming chronological order in loop)
      // Highest high
      if (day.high > w.high) w.high = day.high;
      // Lowest low
      if (day.low < w.low) w.low = day.low;
      // Latest close (assuming chronological order)
      w.close = day.close;
      w.volume += (day.volume || 0);
      w.days += 1;
    }
  }

  // Convert to array and sort chronologically
  const weeklyBars = Object.values(weeks).sort((a, b) => a.weekEnding.localeCompare(b.weekEnding));
  
  if (weeklyBars.length === 0) return [];

  // Compute indicators on weekly bars
  const closes = weeklyBars.map(w => w.close);
  const highs = weeklyBars.map(w => w.high);
  const lows = weeklyBars.map(w => w.low);
  const volumes = weeklyBars.map(w => w.volume);

  const returns = calculateReturns(closes);
  
  // Need to compute them iteratively to assign back to each bar
  for (let i = 0; i < weeklyBars.length; i++) {
    const w = weeklyBars[i];
    
    // Returns (1-week return)
    w.returnPct = i > 0 ? (w.close - closes[i - 1]) / closes[i - 1] : null;
    
    // SMA 50
    w.sma50 = i >= 49 ? calculateSMA(closes.slice(0, i + 1), 50) : null;
    
    // EMA 20
    w.ema20 = i >= 19 ? calculateEMA(closes.slice(0, i + 1), 20) : null;
    
    // RSI 14
    w.rsi = i >= 14 ? calculateRSI(closes.slice(0, i + 1), 14) : null;
    
    // MACD
    if (i >= 26) {
       const m = calculateMACD(closes.slice(0, i + 1), 12, 26, 9);
       w.macd = m ? m.macdLine : null;
    } else {
       w.macd = null;
    }
    
    // ATR 14
    w.atr = i >= 14 ? calculateATR(highs.slice(0, i + 1), lows.slice(0, i + 1), closes.slice(0, i + 1), 14) : null;
    
    // Volatility (10-week)
    w.volatility = i >= 10 ? calculateVolatility(returns.slice(0, i), 10) : null;
    
    // Drawdown from 52-week high
    const lookback52 = Math.max(0, i - 52);
    const slice52Highs = highs.slice(lookback52, i + 1);
    const highest52 = Math.max(...slice52Highs);
    w.drawdown = highest52 > 0 ? (w.close - highest52) / highest52 : 0;
    
    // Volume vs Average 20-week
    const avgVol = i >= 20 ? calculateSMA(volumes.slice(0, i + 1), 20) : null;
    w.volumeVsAverage = avgVol ? w.volume / avgVol : null;
  }

  // Return last 26 weeks (~6 months)
  return weeklyBars.slice(-26);
}

function calculateSMA(data, period) {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(data, period) {
  if (data.length < period) return null;
  const k = 2 / (period + 1);
  let ema = data[0];
  for (let i = 1; i < data.length; i++) {
    ema = (data[i] * k) + (ema * (1 - k));
  }
  return ema;
}

function calculateRSI(data, period) {
  if (data.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(data, fast, slow, signal) {
  if (data.length < slow + signal) return null;
  const fastEma = calculateEMA(data, fast);
  const slowEma = calculateEMA(data, slow);
  if (fastEma === null || slowEma === null) return null;
  const macdLine = fastEma - slowEma;
  // This is a simplified MACD (just the line, normally signal is EMA of MACD)
  return { macdLine, signalLine: 0, histogram: 0 }; 
}

function calculateBollingerBands(data, period, multiplier) {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
  const stddev = Math.sqrt(variance);
  return {
    upper: sma + (multiplier * stddev),
    middle: sma,
    lower: sma - (multiplier * stddev)
  };
}

function calculateATR(highs, lows, closes, period) {
  if (highs.length < period + 1) return null;
  let trSum = 0;
  for (let i = highs.length - period; i < highs.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    trSum += Math.max(hl, hc, lc);
  }
  return trSum / period;
}

function calculateReturns(data) {
  const returns = [];
  for (let i = 1; i < data.length; i++) {
    returns.push((data[i] - data[i - 1]) / data[i - 1]);
  }
  return returns;
}

function calculateVolatility(returns, period) {
  if (returns.length < period) return null;
  const slice = returns.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
  return Math.sqrt(variance) * Math.sqrt(252); // Annualized approximation
}
