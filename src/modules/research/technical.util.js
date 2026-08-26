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
