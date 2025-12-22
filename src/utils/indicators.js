// src/utils/indicators.js

/**
 * Calculate Simple Moving Average (SMA)
 * @param {Array<number>} data - Array of prices
 * @param {number} period - Window size
 * @returns {Array<number|null>} Array of SMA values aligned with input data
 */
export function calculateSMA(data, period) {
    const sma = new Array(data.length).fill(null);
    for (let i = period - 1; i < data.length; i++) {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma[i] = sum / period;
    }
    return sma;
}

/**
 * Calculate Exponential Moving Average (EMA)
 * @param {Array<number>} data - Array of prices
 * @param {number} period - Window size
 * @returns {Array<number|null>} Array of EMA values
 */
export function calculateEMA(data, period) {
    const ema = new Array(data.length).fill(null);
    const multiplier = 2 / (period + 1);

    // Start with SMA for the first EMA value
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i];
    }
    const initialSMA = sum / period;
    ema[period - 1] = initialSMA;

    // Calculate rest
    for (let i = period; i < data.length; i++) {
        ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
    }
    return ema;
}

/**
 * Calculate Relative Strength Index (RSI)
 * @param {Array<number>} data - Array of prices
 * @param {number} period - Typically 14
 * @returns {Array<number|null>} Array of RSI values
 */
export function calculateRSI(data, period = 14) {
    const rsi = new Array(data.length).fill(null);
    if (data.length < period + 1) return rsi;

    let gains = 0;
    let losses = 0;

    // First period
    for (let i = 1; i <= period; i++) {
        const change = data[i] - data[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    rsi[period] = 100 - (100 / (1 + (avgGain / (avgLoss === 0 ? 1 : avgLoss))));

    // Subsequent periods
    for (let i = period + 1; i < data.length; i++) {
        const change = data[i] - data[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;

        const rs = avgGain / (avgLoss === 0 ? 1 : avgLoss);
        rsi[i] = 100 - (100 / (1 + rs));
    }

    return rsi;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * @param {Array<number>} data - Array of prices
 * @param {number} fastPeriod - Typically 12
 * @param {number} slowPeriod - Typically 26
 * @param {number} signalPeriod - Typically 9
 * @returns {Object} { MACD: [], Signal: [], Histogram: [] }
 */
export function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const macdLine = new Array(data.length).fill(null);
    const signalLine = new Array(data.length).fill(null);
    const histogram = new Array(data.length).fill(null);

    const emaFast = calculateEMA(data, fastPeriod);
    const emaSlow = calculateEMA(data, slowPeriod);

    // Calculate MACD Line
    for (let i = 0; i < data.length; i++) {
        if (emaFast[i] !== null && emaSlow[i] !== null) {
            macdLine[i] = emaFast[i] - emaSlow[i];
        }
    }

    // Calculate Signal Line (EMA of MACD Line)
    // Need to extract valid MACD values to calculate their EMA, then map back to original indices
    const validMacdIndices = [];
    const validMacdValues = [];
    
    macdLine.forEach((val, idx) => {
        if (val !== null) {
            validMacdIndices.push(idx);
            validMacdValues.push(val);
        }
    });

    if (validMacdValues.length > 0) {
        const signalValues = calculateEMA(validMacdValues, signalPeriod);
        
        signalValues.forEach((val, idx) => {
            if (val !== null) {
                const originalIndex = validMacdIndices[idx];
                signalLine[originalIndex] = val;
                histogram[originalIndex] = macdLine[originalIndex] - val;
            }
        });
    }

    return { params: { fast: fastPeriod, slow: slowPeriod, signal: signalPeriod }, macd: macdLine, signal: signalLine, histogram };
}

/**
 * Calculate Bollinger Bands
 * @param {Array<number>} data - Array of prices
 * @param {number} period - Typically 20
 * @param {number} stdDevMultiplier - Typically 2
 * @returns {Object} { upper: [], middle: [], lower: [] }
 */
export function calculateBollingerBands(data, period = 20, stdDevMultiplier = 2) {
    const upper = new Array(data.length).fill(null);
    const middle = new Array(data.length).fill(null); // This is just SMA
    const lower = new Array(data.length).fill(null);

    for (let i = period - 1; i < data.length; i++) {
        // Calculate SMA (Middle Band)
        const slice = data.slice(i - period + 1, i + 1);
        const mean = slice.reduce((sum, val) => sum + val, 0) / period;
        middle[i] = mean;

        // Calculate Standard Deviation
        const squaredDiffs = slice.map(val => Math.pow(val - mean, 2));
        const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / period;
        const stdDev = Math.sqrt(variance);

        upper[i] = mean + (stdDev * stdDevMultiplier);
        lower[i] = mean - (stdDev * stdDevMultiplier);
    }

    return { upper, middle, lower };
}
