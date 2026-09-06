import cron from 'node-cron';
import AnalysisRun from '../models/analysisRun.model.js';
import researchService from '../modules/research/research.service.js';
import fs from 'fs/promises';
import path from 'path';

const ML_AUDIT_BASE = path.resolve(process.cwd(), '..', 'ml_service', 'news_audit_artifacts');
const MAX_CONCURRENT_TICKERS = 1;

/**
 * Runs an array of tasks with a concurrency limit
 */
async function runWithConcurrency(items, limit, asyncFn) {
  const results = [];
  const executing = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => asyncFn(item));
    results.push(p);
    
    if (limit <= items.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

export async function runDailyResearchBatch() {
  const analysisDateStr = new Date().toISOString().split('T')[0];
  const analysisDate = new Date(analysisDateStr);
  const pipelineVersion = 'v1.0';
  
  console.log(`[ResearchCron] Starting daily batch ${analysisDateStr}`);
  
  try {
    let symbols = [];
    try {
      console.log(`[ResearchCron] Fetching trending stocks for the day...`);
      // We dynamically import node-fetch if global fetch is not available in node 18+ (it should be, but just in case)
      const res = await fetch('https://acutrader-backend.onrender.com/api/market/trending');
      const data = await res.json();
      
      // We expect { data: [ { symbol: '...' }, ... ] } or similar
      const rawTrending = data?.data || data;
      if (Array.isArray(rawTrending)) {
        symbols = rawTrending.slice(0, 25).map(t => typeof t === 'string' ? t : t.symbol).filter(Boolean);
      }
      
      if (symbols.length === 0) {
         console.warn("[ResearchCron] Trending API returned empty array. Falling back to default list.");
         symbols = ["NVDA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "TSLA", "AMD", "NFLX", "INTC"];
      }
    } catch (apiErr) {
      console.error(`[ResearchCron] Failed to fetch trending stocks, using fallback: ${apiErr.message}`);
      symbols = ["NVDA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "TSLA", "AMD", "NFLX", "INTC"];
    }
    
    // De-duplicate symbols just in case
    symbols = [...new Set(symbols)];
    
    console.log(`[ResearchCron] Found ${symbols.length} active symbols to process:`, symbols.join(", "));

    const batchDir = path.join(ML_AUDIT_BASE, `${analysisDateStr}_batch`);
    await fs.mkdir(batchDir, { recursive: true });

    const results = await runWithConcurrency(symbols, MAX_CONCURRENT_TICKERS, async (symbol) => {
      console.log(`[ResearchPipeline] ${symbol} started`);
      const startTime = Date.now();
      let status = "FAILED";
      
      try {
        // Idempotency: Create or get the run
        let run = await AnalysisRun.findOne({
          symbol,
          analysis_date: analysisDate,
          pipeline_version: pipelineVersion
        });

        if (!run) {
          run = await AnalysisRun.create({
            symbol,
            analysis_date: analysisDate,
            pipeline_version: pipelineVersion,
            status: "RUNNING",
            started_at: new Date()
          });
        } else if (run.status === "SUCCESS") {
          console.log(`[ResearchPipeline] ${symbol} already succeeded today. Skipping.`);
          return { symbol, status: "SUCCESS", durationMs: 0 };
        } else {
          // Retry
          run = await AnalysisRun.findByIdAndUpdate(run._id, {
            status: "RUNNING",
            started_at: new Date()
          }, { new: true });
        }

        // Execute pipeline
        const result = await researchService.getResearchForSymbol(symbol, {
          forceML: true,
          audit: true,
          analysisRunId: run._id,
          analysisDate: analysisDateStr
        });

        status = result.success ? "SUCCESS" : (result.status === "insufficient_input_data" ? "INSUFFICIENT_DATA" : "FAILED");
        
        await AnalysisRun.findByIdAndUpdate(run._id, {
          status,
          completed_at: new Date()
        });

      } catch (err) {
        console.error(`[ResearchPipeline] ❌ Exception processing ${symbol}:`, err.message);
      }
      
      const durationMs = Date.now() - startTime;
      console.log(`[ResearchPipeline] ${symbol} completed with status: ${status} in ${durationMs}ms`);
      return { symbol, status, durationMs };
    });
    
    const summary = {
      analysisDate: analysisDateStr,
      tickerCount: symbols.length,
      completed: symbols.length,
      successful: results.filter(r => r.status === "SUCCESS").length,
      partial: results.filter(r => r.status === "PARTIAL").length,
      insufficientData: results.filter(r => r.status === "INSUFFICIENT_DATA").length,
      failed: results.filter(r => r.status === "FAILED").length,
      tickers: results.reduce((acc, curr) => {
        acc[curr.symbol] = { status: curr.status, durationMs: curr.durationMs };
        return acc;
      }, {})
    };

    await fs.writeFile(path.join(batchDir, 'batch_summary.json'), JSON.stringify(summary, null, 2));

    console.log(`[ResearchCron] Daily batch completed.`);
    console.log(`[ResearchCron] Success: ${summary.successful}`);
    console.log(`[ResearchCron] Insufficient: ${summary.insufficientData}`);
    console.log(`[ResearchCron] Failed: ${summary.failed}`);
    
  } catch (error) {
    console.error('[ResearchCron] Fatal error during batch execution:', error);
  }
}

export function initDailyForecastJob() {
  console.log('[ResearchCron] Enabled');
  console.log('[ResearchCron] Schedule: 00:30 daily');
  console.log(`[ResearchCron] Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  
  // 30 0 * * * = 12:30 AM every day
  cron.schedule('30 0 * * *', () => {
    runDailyResearchBatch();
  });
}
