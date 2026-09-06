import marketDataService from "../market/MarketDataService.js";
import newsService from "../news/news.service.js";
import forecastService from "../forecast/forecast.service.js";
import llmService from "../llm/llm.service.js";
import { computeTechnicals, computeWeeklyContext } from "./technical.util.js";
import fs from 'fs/promises';
import path from 'path';
import AnalysisResult from "../../models/analysisResult.model.js";

const FORECAST_DIR = path.join(process.cwd(), 'data', 'forecasts');
const ML_AUDIT_BASE = path.resolve(process.cwd(), '..', 'ml_service', 'news_audit_artifacts');

class ResearchService {
  // Simple CSV stringifier
  _toCSV(arr) {
    if (!arr || arr.length === 0) return '';
    const keys = Object.keys(arr[0]);
    const rows = arr.map(obj => keys.map(k => {
      let val = obj[k];
      if (val === null || val === undefined) val = '';
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
    }).join(','));
    return [keys.join(','), ...rows].join('\n');
  }

  _getNextTradingDays(startDateStr, numDays) {
    const dates = [];
    let current = new Date(startDateStr);
    
    // Safety check if date is invalid
    if (isNaN(current.getTime())) {
      current = new Date();
    }
    
    while (dates.length < numDays) {
      current.setDate(current.getDate() + 1);
      const day = current.getDay();
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (day !== 0 && day !== 6) {
        dates.push(current.toISOString().split('T')[0]);
      }
    }
    return dates;
  }

  async getResearchForSymbol(symbol, options = {}) {
    const { forceML = false, audit = false } = options;
    const symbolDir = path.join(FORECAST_DIR, symbol.toUpperCase());
    const latestFilePath = path.join(symbolDir, 'latest.json');
    
    if (!forceML) {
       try {
         const data = await fs.readFile(latestFilePath, 'utf-8');
         return JSON.parse(data);
       } catch (err) {
         return {
           success: false,
           status: "NO_PERSISTED_FORECAST",
           message: "No daily forecast available for this symbol. The nightly pipeline has not processed it yet."
         };
       }
    }

    const generatedAt = new Date().toISOString();
    const todayStr = generatedAt.split('T')[0];
    const AUDIT_DIR = path.join(ML_AUDIT_BASE, symbol.toUpperCase(), todayStr);
    
    if (audit) {
      await fs.mkdir(AUDIT_DIR, { recursive: true }).catch(() => {});
    }
    await fs.mkdir(symbolDir, { recursive: true }).catch(() => {});

    console.log(`[ResearchService] Forcing ML pipeline execution for ${symbol}... (audit=${audit})`);
    
    // Phase 1: Market Data
    const marketRes = await marketDataService.getQuote(symbol);
    const market = marketRes?.data || {};

    // Extract fundamentals explicitly
    const fundamentalKeys = [
      'currentPrice', 'open', 'high', 'low', 'previousClose', 'change', 'changePercent', 
      'volume', 'averageVolume', 'marketCap', 'pe', 'forwardPE', 'trailingPE', 'pegRatio', 
      'priceToSales', 'priceToBook', 'evToEBITDA', 'revenue', 'netIncome', 'profitMargin',
      'operatingMargin', 'returnOnEquity', 'totalCash', 'totalDebt',
      'debtToEquity', 'sector', 'industry'
    ];
    
    const fundamentals = {
      AVAILABLE: {},
      MISSING: [],
      DERIVED: {},
      NOT_APPLICABLE: [],
      STALE: []
    };
    
    fundamentalKeys.forEach(key => {
      if (market[key] !== undefined && market[key] !== null && market[key] !== 0) {
        fundamentals.AVAILABLE[key] = market[key];
      } else {
        fundamentals.MISSING.push(key);
      }
    });

    if (audit) {
      await fs.writeFile(path.join(AUDIT_DIR, '09_fundamental_context.json'), JSON.stringify(fundamentals, null, 2)).catch(() => {});
    }

    // Phase 2/3: Historical Data
    const historyRes = await marketDataService.getHistoricalData(symbol, "5y", "1d");
    const history = historyRes?.data || [];
    
    if (audit) {
      await fs.writeFile(path.join(AUDIT_DIR, '07_daily_ohlcv.csv'), this._toCSV(history)).catch(() => {});
    }

    // Phase 4: Compute Technicals & Weekly Context
    const technicals = computeTechnicals(history);
    const weeklyContext = computeWeeklyContext(history);
    
    if (audit) {
      await fs.writeFile(path.join(AUDIT_DIR, '08_weekly_6m_technical.csv'), this._toCSV(weeklyContext)).catch(() => {});
    }

    // Pipeline Gating Setup
    const pipelineStatus = {
      market: {
        status: Object.keys(fundamentals.AVAILABLE).length > 0 ? 'ready' : 'missing',
        featureCount: Object.keys(fundamentals.AVAILABLE).length
      },
      ohlcv: {
        status: history.length >= 20 ? 'ready' : 'insufficient',
        recordCount: history.length
      },
      technicals: {
        status: Object.keys(technicals).length > 5 ? 'ready' : 'partial',
        featureCount: Object.keys(technicals).length
      },
      news: {
        status: 'pending',
        recordCount: 0
      },
      forecast: { status: 'pending' },
      llm: { status: 'pending' }
    };

    // Block ONLY if strictly required data is missing
    if (pipelineStatus.market.status === 'missing' || pipelineStatus.ohlcv.status === 'insufficient') {
      const finalErr = {
        success: false,
        status: "insufficient_input_data",
        pipeline: pipelineStatus,
        data: null
      };
      if (audit) await fs.writeFile(path.join(AUDIT_DIR, '14_final_api_response.json'), JSON.stringify(finalErr, null, 2)).catch(() => {});
      return finalErr;
    }

    // DEFINE CANONICAL AS-OF DATE AND REFERENCE PRICE
    // Latest available valid history date is authoritative
    const latestOHLCV = history[history.length - 1];
    const canonicalAsOf = (latestOHLCV.date || latestOHLCV.datetime || generatedAt).split('T')[0];
    const referencePrice = latestOHLCV.close; // strictly OHLCV close
    
    // Future forecast dates
    const tradingDates = this._getNextTradingDays(canonicalAsOf, 3);
    const forecastDates = {
      day_1: tradingDates[0],
      day_2: tradingDates[1],
      day_3: tradingDates[2]
    };

    // Phase 5-8: News Pipeline
    const news = await newsService.getNewsForSymbol(symbol, 30, { audit });

    // Filter out news that comes strictly AFTER canonicalAsOf (Data Leakage Protection)
    const cutoffTime = new Date(`${canonicalAsOf}T23:59:59.999Z`).getTime();
    const validNewsArticles = (news?.articles || []).filter(article => {
      if (!article.published_at) return false;
      const articleTime = new Date(article.published_at).getTime();
      return articleTime <= cutoffTime;
    });

    pipelineStatus.news.status = validNewsArticles.length > 0 ? 'ready' : 'partial';
    pipelineStatus.news.recordCount = validNewsArticles.length;

    if (audit) {
      await fs.writeFile(path.join(AUDIT_DIR, '13_pipeline_readiness.json'), JSON.stringify(pipelineStatus, null, 2)).catch(() => {});
    }

    const forecastPayload = {
      analysis_cutoff: canonicalAsOf, // using canonical As-Of
      window_start: news?.metadata?.window_start || new Date().toISOString(),
      window_end: canonicalAsOf,
      audit
    };
    
    // Attempt downstream forecast, but don't block LLM if it fails
    const forecastRes = await forecastService.getForecastForSymbol(
      symbol,
      history,
      validNewsArticles,
      technicals,
      fundamentals.AVAILABLE,
      forecastPayload
    );

    const researchContext = {
      symbol,
      canonicalAsOf,
      referencePrice,
      forecastDates,
      market: fundamentals.AVAILABLE,
      historical: history.slice(-5), // Just pass last 5 days
      weekly6m: weeklyContext,
      technicals: technicals,
      news: {
        articles: validNewsArticles,
        metadata: news?.metadata || {}
      },
      models: {
        xgboost: forecastRes?.success ? forecastRes.forecast : null,
        downstream: forecastRes?.success ? forecastRes.downstream : null
      }
    };

    if (audit) {
      await fs.writeFile(path.join(AUDIT_DIR, '12_llm_context.json'), JSON.stringify(researchContext, null, 2)).catch(() => {});
    }

    // LLM Synthesis
    const llmResult = await llmService.synthesizeContext(symbol, researchContext);
    const llmSynthesis = llmResult?.data || {};
    
    // Update LLM status properly
    if (!llmResult?.success) {
      if (llmResult?.error?.stage === "json_validation") {
        pipelineStatus.llm.status = "ready";
        pipelineStatus.forecast.status = "failed";
        pipelineStatus.forecast.error = llmResult.error;
      } else {
        pipelineStatus.llm.status = "failed";
        pipelineStatus.llm.error = llmResult?.error || { code: "LLM_CALL_FAILED", message: "Unknown error" };
        pipelineStatus.forecast.status = "failed";
      }
    } else {
      pipelineStatus.llm.status = "ready";
      pipelineStatus.forecast.status = "ready"; // Marked ready if validation completely passed
    }

    pipelineStatus.llm.metadata = llmResult?.metadata || {};

    const finalResult = {
      success: true,
      symbol,
      raw_article_count: news?.metadata?.raw_articles || 0,
      valid_article_count: news?.metadata?.date_valid_articles || 0,
      deduplicated_count: news?.metadata?.duplicates_removed || 0,
      relevant_count: validNewsArticles.length,
      final_article_count: validNewsArticles.length,
      
      market_context: fundamentals,
      technical_context: technicals,
      
      numerical_evidence: {
        news_volume: validNewsArticles.length,
        current_price: referencePrice,
        current_volatility: technicals.volatility || null,
        trend_regime: technicals.sma50 > technicals.sma200 ? "Bullish" : "Bearish",
        volume_anomaly: technicals.volumeRatio || null
      },
      
      models: {
        xgboost: forecastRes?.forecast || null,
        newsLstm: forecastRes?.news_context || null,
        llmSynthesis: llmSynthesis || null
      },

      forecast_metadata: {
        reference_price: referencePrice,
        reference_date: canonicalAsOf,
        forecast_horizon: "3_trading_days",
        news_evidence_count: llmSynthesis?.evidence ? llmSynthesis.evidence.length : 0,
        forecast_generated_at: generatedAt,
        llm_model: llmResult?.metadata?.model || "unknown",
        validation_status: pipelineStatus.forecast.status === "ready" ? "passed" : "failed"
      },
      
      pipelineStatus,
      generatedAt
    };

    const auditArtifact = {
      testMetadata: {
        symbol,
        executedAt: generatedAt,
      },
      pipelineStatus,
      forecastRes
    };

    try {
      // Dump audit logs unconditionally
      if (audit) {
        await fs.writeFile(path.join(AUDIT_DIR, '14_final_api_response.json'), JSON.stringify(finalResult, null, 2)).catch(() => {});
        await fs.writeFile(path.join(AUDIT_DIR, 'pipeline_audit.json'), JSON.stringify(auditArtifact, null, 2)).catch(() => {});
      }

      // Persist to `latest.json` ONLY if forecast validation succeeded
      if (pipelineStatus.forecast.status === "ready") {
        await fs.writeFile(latestFilePath, JSON.stringify(finalResult, null, 2));
        
        // Save historical dated file
        const datedFilePath = path.join(symbolDir, `${canonicalAsOf}.json`);
        await fs.writeFile(datedFilePath, JSON.stringify(finalResult, null, 2));
        
        console.log(`[ResearchService] Persisted new forecast for ${symbol} at ${canonicalAsOf}`);

        if (options.analysisRunId && options.analysisDate) {
          await AnalysisResult.findOneAndUpdate(
            { symbol, analysis_date: new Date(options.analysisDate) },
            {
              $set: {
                analysis_run_id: options.analysisRunId,
                symbol,
                analysis_date: new Date(options.analysisDate),
                market_context: fundamentals,
                technical_context: technicals,
                fundamental_context: fundamentals,
                news_context: news,
                model_outputs: forecastRes?.forecast || null,
                forecast: forecastRes,
                llm_context: llmSynthesis ? { llmSynthesis } : null,
                llm_output: llmSynthesis || null,
                data_quality: pipelineStatus
              }
            },
            { upsert: true, new: true }
          );
        }
      } else {
        // Just save a failed run for diagnostics
        const failedFilePath = path.join(symbolDir, `${canonicalAsOf}_failed.json`);
        await fs.writeFile(failedFilePath, JSON.stringify(finalResult, null, 2));
        console.warn(`[ResearchService] Forecast validation failed for ${symbol}. Not overwriting latest.json. Output saved to ${canonicalAsOf}_failed.json`);
      }

    } catch (err) {
      console.error(`[ResearchService] Failed to persist forecast for ${symbol}:`, err.message);
    }

    return finalResult;
  }
}

export default new ResearchService();
