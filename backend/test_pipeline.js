import './src/config/env.js';
import mongoose from 'mongoose';
import { config } from './src/config/env.js';
import researchService from './src/modules/research/research.service.js';

const TRENDING_API =
  'https://acutrader-backend.onrender.com/api/market/trending';

async function fetchTrendingSymbols() {
  console.log(`Fetching trending symbols from ${TRENDING_API}...`);

  const response = await fetch(TRENDING_API);

  if (!response.ok) {
    throw new Error(
      `Trending API failed: HTTP ${response.status} ${response.statusText}`
    );
  }

  const payload = await response.json();

  if (!payload?.success) {
    throw new Error(
      `Trending API returned success=false: ${JSON.stringify(payload)}`
    );
  }

  const symbols = payload?.data?.symbols;

  if (!Array.isArray(symbols) || symbols.length === 0) {
    throw new Error('Trending API returned no symbols.');
  }

  // Remove duplicates while preserving API order.
  return [...new Set(
    symbols
      .map(symbol => String(symbol).trim().toUpperCase())
      .filter(Boolean)
  )];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  if (config.mongoUri) {
    try {
      await mongoose.connect(config.mongoUri);
      console.log('Connected to MongoDB');
    } catch (err) {
      console.error('Failed to connect to MongoDB:', err.message);
      process.exit(1);
    }
  }

  const startTime = Date.now();

  try {
    // ============================================================
    // 1. FETCH ALL SYMBOLS FROM TRENDING API
    // ============================================================

    const symbols = await fetchTrendingSymbols();

    console.log('\n============================================================');
    console.log(`Found ${symbols.length} symbols`);
    console.log(symbols.join(', '));
    console.log('============================================================\n');

    // ============================================================
    // 2. PROCESS EVERY TICKER SEQUENTIALLY
    // ============================================================
    //
    // IMPORTANT:
    // - DO NOT use Promise.all()
    // - DO NOT use Promise.allSettled()
    // - The next ticker starts ONLY after the previous ticker's
    //   entire research/model pipeline has returned.
    //
    // ============================================================

    const results = [];

    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];

      console.log('\n');
      console.log('############################################################');
      console.log(`# TICKER ${i + 1}/${symbols.length}: ${symbol}`);
      console.log('############################################################');

      const tickerStartTime = Date.now();

      try {
        console.log(`[${symbol}] Starting complete pipeline...`);

        /*
         * CRITICAL:
         *
         * Await the ENTIRE result before continuing.
         *
         * This means:
         *
         * market
         *   -> OHLCV
         *   -> technicals
         *   -> news
         *   -> sentiment
         *   -> LLM/OpenRouter
         *   -> LLM response
         *   -> validation
         *   -> final result
         *
         * must all finish before this loop moves to the next symbol.
         */
        const result = await researchService.getResearchForSymbol(
          symbol,
          {
            forceML: true,
            audit: true
          }
        );

        const tickerDuration = Date.now() - tickerStartTime;

        console.log(`\n[${symbol}] --- FINAL RESULT ---`);
        console.log(`[${symbol}] Success:`, result.success);

        console.log(
          `[${symbol}] Pipeline Status:`,
          JSON.stringify(result.pipelineStatus, null, 2)
        );

        const llmOutput = result.models?.llmSynthesis;

        if (llmOutput) {
          console.log(`\n[${symbol}] --- LLM Forecast ---`);

          console.log(
            `[${symbol}] Day 1 populated:`,
            !!llmOutput.forecast?.day_1
          );

          console.log(
            `[${symbol}] Day 2 populated:`,
            !!llmOutput.forecast?.day_2
          );

          console.log(
            `[${symbol}] Day 3 populated:`,
            !!llmOutput.forecast?.day_3
          );

          const p1 = llmOutput.forecast?.day_1?.probabilities;

          if (p1) {
            const sum =
              (p1.bull_case || 0) +
              (p1.neutral_case || 0) +
              (p1.bear_case || 0);

            console.log(
              `[${symbol}] Day 1 Probabilities sum to 1:`,
              Math.abs(sum - 1.0) < 0.05,
              `(Sum: ${sum})`
            );
          }

          console.log(
            `[${symbol}] Day 1 Date:`,
            llmOutput.forecast?.day_1?.date
          );

          console.log(
            `[${symbol}] Day 2 Date:`,
            llmOutput.forecast?.day_2?.date
          );

          console.log(
            `[${symbol}] Day 3 Date:`,
            llmOutput.forecast?.day_3?.date
          );
        } else {
          console.log(`[${symbol}] No LLM synthesis returned.`);
        }

        console.log(
          `[${symbol}] Complete pipeline time: ${tickerDuration}ms`
        );

        results.push({
          symbol,
          success: result.success,
          durationMs: tickerDuration,
          pipelineStatus: result.pipelineStatus,
          llmAvailable: !!llmOutput,
          error: null
        });

      } catch (err) {
        /*
         * IMPORTANT:
         *
         * A single ticker failure must NOT terminate the complete
         * ticker loop.
         *
         * The next ticker will only start after this catch completes.
         */
        const tickerDuration = Date.now() - tickerStartTime;

        console.error(
          `[${symbol}] Pipeline failed after ${tickerDuration}ms:`,
          err?.message || err
        );

        results.push({
          symbol,
          success: false,
          durationMs: tickerDuration,
          pipelineStatus: null,
          llmAvailable: false,
          error: err?.message || String(err)
        });
      }

      // ============================================================
      // 3. WAIT BEFORE NEXT TICKER
      // ============================================================
      //
      // The previous researchService call has ALREADY completely
      // resolved at this point.
      //
      // Wait at least 60 seconds before allowing the next ticker's
      // LLM request/pipeline to start.
      //
      // ============================================================

      if (i < symbols.length - 1) {
        const nextSymbol = symbols[i + 1];

        console.log('\n------------------------------------------------------------');
        console.log(
          `[Pipeline] ${symbol} finished. Previous response received.`
        );
        console.log(
          `[Pipeline] Waiting 60 seconds before processing ${nextSymbol}...`
        );
        console.log('------------------------------------------------------------\n');

        await sleep(60_000);

        console.log(
          `[Pipeline] 60-second wait completed. Starting ${nextSymbol}.`
        );
      }
    }

    // ============================================================
    // 4. FINAL PIPELINE SUMMARY
    // ============================================================

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log('\n\n============================================================');
    console.log('                 PIPELINE COMPLETE');
    console.log('============================================================');

    console.log(`Total symbols: ${symbols.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    console.log(`Total time: ${Date.now() - startTime}ms`);

    console.log('\n--- SUCCESSFUL ---');

    successful.forEach(result => {
      console.log(
        `${result.symbol} | ${result.durationMs}ms | LLM: ${result.llmAvailable}`
      );
    });

    if (failed.length > 0) {
      console.log('\n--- FAILED ---');

      failed.forEach(result => {
        console.log(
          `${result.symbol} | ${result.durationMs}ms | ${result.error}`
        );
      });
    }

    console.log('\n============================================================');
    console.log('All symbols have been processed sequentially.');
    console.log('============================================================');

  } catch (err) {
    console.error('\nPipeline runner failed:', err);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
  }
}

runTest();