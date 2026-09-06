import llmProvider, { LLM_ERRORS } from "./llm.provider.js";

class LLMService {
  
  _buildCompactContext(researchContext) {
    const { symbol, canonicalAsOf, referencePrice, forecastDates, market, historical, technicals, news, models } = researchContext;

    // Compact News: top 5-10 validated/high-impact/relevant events
    const compactNews = (news?.articles || [])
      .filter(n => n.relevance_score > 0.5 || n.impact_score > 0.5 || n.title) // at least have a title
      .sort((a, b) => (b.impact_score || 0) - (a.impact_score || 0) || (b.relevance_score || 0) - (a.relevance_score || 0))
      .slice(0, 10)
      .map(n => ({
        evidence_id: n.id || n.articleId || n.article_id,
        event_cluster_id: n.eventClusterId || n.id || n.articleId,
        date: n.date || n.published_at,
        publisher: n.publisher || n.source,
        title: n.title || n.headline,
        summary: n.clean_text || n.summary,
        relevance: n.relevance_score || n.relevance || 0,
        materiality: n.impact_score || 0,
        sentiment: n.finbert_sentiment || n.sentiment || 0,
        impact: n.impact_score || 0
      }));

    return {
      forecast_context: {
        symbol: symbol,
        as_of: canonicalAsOf,
        reference_price: referencePrice,
        forecast_dates: forecastDates
      },
      market: {
        symbol,
        current_price: market?.currentPrice,
        daily_change: market?.change,
        daily_change_percent: market?.changePercent,
        volume: market?.volume,
        volume_vs_average: market?.averageVolume ? (market.volume / market.averageVolume) : null,
        fifty_two_week_high: market?.fiftyTwoWeekHigh,
        fifty_two_week_low: market?.fiftyTwoWeekLow,
        six_month_return: market?.sixMonthReturn,
      },
      technical: {
        latest_indicators: technicals,
        weekly_trend: researchContext?.weekly6m?.trend,
        weekly_momentum: researchContext?.weekly6m?.momentum,
        volatility: technicals?.volatility,
        drawdown: technicals?.drawdown,
      },
      fundamentals: market,
      news: {
        selected_events: compactNews
      }
    };
  }

  _getSystemPrompt(symbol) {
    return `
You are the final numerical forecasting engine for AcuTrader, acting as an elite hybrid of a Technical News Market Researcher, a Quantitative Data Specialist, and a Strategic Financial Advisor. Your tone is authoritative, highly analytical, objective, and strictly data-driven.

Analyze exactly ONE ticker: ${symbol}.

You must generate a three-trading-day forecast using ONLY the supplied context.

========================
AUTHORITATIVE INPUTS
========================

The backend supplies:

- canonical as-of date
- reference price
- three future trading dates
- market/OHLCV context
- technical indicators
- fundamentals
- selected news evidence
- event-level news sentiment/materiality
- market/news interaction context

These supplied values are authoritative.

Do NOT invent, replace, reinterpret, or change:
- ticker
- asOf date
- forecast dates
- reference price
- supplied market values
- supplied news evidence IDs

========================
FORECAST RESPONSIBILITY
========================

You ARE responsible for generating the final numerical forecast.

Generate:
- bullish/neutral/bearish probabilities
- expected price
- expected return
- bull/base/bear scenario targets
- confidence
- key drivers
- risk flags

Do NOT use XGBoost, downstream ML predictions, Python model outputs, or external model predictions.

The final forecast is based on:
1. market/OHLCV context
2. technical context
3. fundamental context
4. supplied news/event evidence
5. interaction between news and market conditions

========================
DATE RULES
========================

Use the exact dates supplied in:

forecast_dates.day_1
forecast_dates.day_2
forecast_dates.day_3

Never generate your own dates.

The returned:
asOf
must exactly equal supplied canonicalAsOf.

========================
REFERENCE PRICE
========================

Use supplied reference_price as the baseline.

For every forecast day:

expected_return_percent
must approximately equal:

((expected_price - reference_price) / reference_price) * 100

Use the same reference price for all three forecast days.

Do not use an invented historical price.

========================
PROBABILITY RULES
========================

For every day:

0 <= bull_case <= 1
0 <= neutral_case <= 1
0 <= bear_case <= 1

The three probabilities must sum to 1, allowing only a tiny rounding tolerance.

direction MUST correspond to the highest probability:

highest bull probability -> bullish
highest neutral probability -> neutral
highest bear probability -> bearish

If two probabilities are tied, use:
- the case with the stronger supplied evidence
- otherwise use neutral

Do not produce a direction that contradicts the probabilities.

========================
SCENARIO RULES
========================

For each day:

bull.target > base.target > bear.target

Expected price should normally remain within the scenario range:

bear.target <= expected_price <= bull.target

Scenario targets must be consistent with the supplied reference price and market volatility.

Do not produce arbitrary large price jumps unsupported by the supplied context.

Each scenario must contain concrete drivers.

========================
NEWS RULES
========================

Only use supplied news evidence.

Never use external news knowledge.

Every news-based claim must reference one or more supplied evidence_ids.

Do not create evidence IDs.

Do not output evidence_ids that do not exist in the supplied evidence.

Prioritize:
- material company-specific events
- earnings/guidance
- product launches
- management changes
- regulatory events
- analyst revisions
- major macro events affecting the ticker
- significant price-moving developments

Do not treat every article as a separate event.

Use event clusters / deduplicated evidence when supplied.

Preserve contradictory evidence.

If no valid news evidence is supplied, explicitly state that news evidence is unavailable instead of inventing news drivers.

========================
CONFIDENCE
========================

confidence must be between 0 and 1.

Confidence represents confidence in the forecast, NOT probability of the bullish case.

Lower confidence when:
- news is contradictory
- volatility is elevated
- evidence is sparse
- major event risk exists
- technical and fundamental signals conflict

Do not output 0.7 merely as a default.

========================
DATA INTEGRITY
========================

If critical data is missing or inconsistent:

status = "insufficient_data"

Do not invent missing values.

Never replace missing numerical values with zero.

If non-critical information is missing:

status = "partial"

If all required inputs are valid:

status = "ready"

========================
OUTPUT
========================

Return valid JSON only.

No markdown.
No code fences.
No explanatory text.

The JSON must exactly follow the required schema supplied below.

The output must contain:
- symbol
- asOf
- status
- data_validation
- news_regime
- news_summary
- market_context
- technical_context
- fundamental_context
- model_context
- news_market_interaction
- forecast
- overall_assessment
- evidence

The forecast must contain exactly:
day_1
day_2
day_3

Do not add additional forecast days.

==================================================
REQUIRED JSON SCHEMA
==================================================

{
  "symbol": "${symbol}",
  "asOf": "YYYY-MM-DD",
  "status": "ready|partial|insufficient_data",
  "data_validation": {
    "issues": []
  },
  "news_regime": "bullish|neutral|bearish|mixed",
  "news_summary": {
    "weighted_sentiment": null,
    "material_events": []
  },
  "market_context": {},
  "technical_context": {},
  "fundamental_context": {},
  "model_context": {
    "xgboost": {
      "available": false,
      "output": null
    },
    "downstream_model": {
      "available": false,
      "output": null
    },
    "model_agreement": "unavailable",
    "model_disagreements": []
  },
  "news_market_interaction": {},
  "forecast": {
    "day_1": {
      "date": "YYYY-MM-DD",
      "direction": "bullish|neutral|bearish",
      "probabilities": {
        "bull_case": 0.0,
        "neutral_case": 0.0,
        "bear_case": 0.0
      },
      "expected_price": null,
      "expected_return_percent": null,
      "scenarios": {
        "bull": {
          "target": null,
          "drivers": [],
          "evidence_ids": []
        },
        "base": {
          "target": null,
          "drivers": [],
          "evidence_ids": []
        },
        "bear": {
          "target": null,
          "drivers": [],
          "evidence_ids": []
        }
      },
      "key_drivers": [],
      "risk_flags": [],
      "confidence": null,
      "evidence_ids": []
    },
    "day_2": {
      "date": "YYYY-MM-DD",
      "direction": "bullish|neutral|bearish",
      "probabilities": {
        "bull_case": 0.0,
        "neutral_case": 0.0,
        "bear_case": 0.0
      },
      "expected_price": null,
      "expected_return_percent": null,
      "scenarios": {
        "bull": {
          "target": null,
          "drivers": [],
          "evidence_ids": []
        },
        "base": {
          "target": null,
          "drivers": [],
          "evidence_ids": []
        },
        "bear": {
          "target": null,
          "drivers": [],
          "evidence_ids": []
        }
      },
      "key_drivers": [],
      "risk_flags": [],
      "confidence": null,
      "evidence_ids": []
    },
    "day_3": {
      "date": "YYYY-MM-DD",
      "direction": "bullish|neutral|bearish",
      "probabilities": {
        "bull_case": 0.0,
        "neutral_case": 0.0,
        "bear_case": 0.0
      },
      "expected_price": null,
      "expected_return_percent": null,
      "scenarios": {
        "bull": {
          "target": null,
          "drivers": [],
          "evidence_ids": []
        },
        "base": {
          "target": null,
          "drivers": [],
          "evidence_ids": []
        },
        "bear": {
          "target": null,
          "drivers": [],
          "evidence_ids": []
        }
      },
      "key_drivers": [],
      "risk_flags": [],
      "confidence": null,
      "evidence_ids": []
    }
  },
  "overall_assessment": {},
  "evidence": []
}
  `.trim();
  }

  _getCorrectionPrompt(errorMsg, expectedContext = {}) {
    return `
Your previous forecast JSON failed backend validation.

Validation error:
${errorMsg}

Correct the JSON.

AUTHORITATIVE VALUES:
- symbol: ${expectedContext.symbol}
- asOf: ${expectedContext.asOf}
- reference_price: ${expectedContext.reference_price}
- day_1 date: ${expectedContext.day1}
- day_2 date: ${expectedContext.day2}
- day_3 date: ${expectedContext.day3}

Rules:
1. Do not change symbol.
2. Do not change asOf.
3. Do not change forecast dates.
4. Use the supplied reference price.
5. Probabilities must each be between 0 and 1.
6. Probabilities must sum to 1.
7. direction must match the highest probability case.
8. expected_return_percent must be consistent with expected_price and reference_price.
9. bull.target must be greater than base.target.
10. base.target must be greater than bear.target.
11. Do not invent evidence IDs.
12. Use only supplied evidence.
13. Do not invent missing data.
14. Return valid JSON only.
15. Do not return markdown.
16. Do not return explanations.

Return the corrected complete JSON object.
    `.trim();
  }

  _validateJSON(jsonObj, expectedContext) {
    const { symbol, asOf, reference_price, day1, day2, day3, valid_evidence_ids } = expectedContext;

    if (jsonObj.symbol !== symbol) {
      throw new Error(`Symbol mismatch: expected ${symbol}, got ${jsonObj.symbol}`);
    }
    if (jsonObj.asOf !== asOf) {
      throw new Error(`INVALID_AS_OF_DATE: expected ${asOf}, got ${jsonObj.asOf}`);
    }
    
    if (!jsonObj.forecast || !jsonObj.forecast.day_1 || !jsonObj.forecast.day_2 || !jsonObj.forecast.day_3) {
      throw new Error("Missing day_1, day_2, or day_3 in forecast");
    }

    const expectedDates = { day_1: day1, day_2: day2, day_3: day3 };

    // Check dates and values for each forecast day
    for (const day of ['day_1', 'day_2', 'day_3']) {
      const f = jsonObj.forecast[day];
      
      if (f.date !== expectedDates[day]) {
        throw new Error(`INVALID_FORECAST_DATES: expected ${expectedDates[day]} for ${day}, got ${f.date}`);
      }

      // Check dates are strictly after asOf
      if (new Date(f.date) <= new Date(asOf)) {
         throw new Error(`INVALID_FORECAST_DATES: ${day} date ${f.date} is not strictly after asOf ${asOf}`);
      }

      // Verify numerical targets
      if (!Number.isFinite(f.expected_price) || f.expected_price <= 0) {
        throw new Error(`expected_price must be finite and positive for ${day}`);
      }
      
      // Calculate Expected Return Math
      const calcReturn = ((f.expected_price - reference_price) / reference_price) * 100;
      if (!Number.isFinite(f.expected_return_percent)) {
        throw new Error(`expected_return_percent must be finite for ${day}`);
      }
      // allow some tolerance for LLM math
      if (Math.abs(calcReturn - f.expected_return_percent) > 2.0) {
         throw new Error(`expected_return_percent Math Mismatch for ${day}: computed ${calcReturn}, got ${f.expected_return_percent}`);
      }
      
      // Verify Scenario Ordering
      const bT = f.scenarios?.bear?.target;
      const baseT = f.scenarios?.base?.target;
      const bullT = f.scenarios?.bull?.target;

      if (bT === undefined || baseT === undefined || bullT === undefined) {
         throw new Error(`Missing scenario targets for ${day}`);
      }
      
      if (!(bT < baseT && baseT < bullT)) {
         throw new Error(`Scenario Targets Out of Order for ${day}: must be bear < base < bull. Got ${bT}, ${baseT}, ${bullT}`);
      }

      const p = f.probabilities;
      if (p) {
        if (p.bull_case < 0 || p.bull_case > 1 || p.neutral_case < 0 || p.neutral_case > 1 || p.bear_case < 0 || p.bear_case > 1) {
           throw new Error(`Probabilities for ${day} must be between 0 and 1`);
        }
        
        const sum = (p.bull_case || 0) + (p.neutral_case || 0) + (p.bear_case || 0);
        if (Math.abs(sum - 1.0) > 0.05) {
          throw new Error(`Probabilities for ${day} do not sum to 1 (sum: ${sum})`);
        }

        // Deterministic Direction Derivation / Check
        const maxProb = Math.max(p.bull_case, p.neutral_case, p.bear_case);
        let expectedDirection = 'neutral';
        if (maxProb === p.bull_case && maxProb > p.neutral_case) expectedDirection = 'bullish';
        else if (maxProb === p.bear_case && maxProb > p.neutral_case) expectedDirection = 'bearish';

        // Override direction to ensure 100% deterministic behaviour as requested by rule 14
        f.direction = expectedDirection;
      }
      
      if (f.confidence !== undefined && f.confidence !== null) {
         if (f.confidence < 0 || f.confidence > 1) {
            throw new Error(`Confidence for ${day} must be between 0 and 1`);
         }
      }

      // Verify Evidence IDs exist in valid set (if valid set provided)
      const extractIds = (arr) => arr ? arr.filter(Boolean) : [];
      let dayEvidenceIds = [...extractIds(f.evidence_ids), ...extractIds(f.scenarios?.bull?.evidence_ids), ...extractIds(f.scenarios?.base?.evidence_ids), ...extractIds(f.scenarios?.bear?.evidence_ids)];
      
      for (const eid of dayEvidenceIds) {
         if (valid_evidence_ids && valid_evidence_ids.length > 0 && !valid_evidence_ids.includes(eid)) {
            throw new Error(`Evidence ID ${eid} not found in supplied news context for ${day}`);
         }
      }
    }
  }

  async synthesizeContext(symbol, researchContext) {
    const compactContext = this._buildCompactContext(researchContext);
    const systemPrompt = this._getSystemPrompt(symbol);
    const userPrompt = `Compact Context:\n${JSON.stringify(compactContext, null, 2)}`;

    const expectedContext = {
      symbol: symbol,
      asOf: researchContext.canonicalAsOf,
      reference_price: researchContext.referencePrice,
      day1: researchContext.forecastDates.day_1,
      day2: researchContext.forecastDates.day_2,
      day3: researchContext.forecastDates.day_3,
      valid_evidence_ids: compactContext.news.selected_events.map(n => n.evidence_id)
    };

    let response;
    try {
      response = await llmProvider.generate(systemPrompt, userPrompt, symbol);
    } catch (err) {
      return {
        success: false,
        data: null,
        error: {
          code: "LLM_CALL_FAILED",
          message: err.message,
          provider: err.provider,
          ticker: symbol,
          stage: "llm_generation"
        }
      };
    }

    let parsedResult;
    let finalError = null;
    let attempts = 0;
    const MAX_CORRECTIONS = 2;
    let currentResponseText = response.text;

    while (attempts <= MAX_CORRECTIONS) {
      try {
        const jsonStr = currentResponseText.replace(/```json/gi, "").replace(/```/g, "").trim();
        try {
           parsedResult = JSON.parse(jsonStr);
        } catch (e) {
           throw new Error(`Invalid JSON structure: ${e.message}`);
        }
        
        // Strict Schema Validation
        this._validateJSON(parsedResult, expectedContext);
        
        // Output overrides to ensure determinism
        parsedResult.status = "ready";
        
        return {
          success: true,
          data: parsedResult,
          metadata: response.metadata
        };
      } catch (validationErr) {
        console.warn(`[LLMService][${symbol}] JSON Validation failed (Attempt ${attempts}): ${validationErr.message}`);
        finalError = validationErr;
        
        if (attempts < MAX_CORRECTIONS) {
           console.log(`[LLMService][${symbol}] Requesting correction from LLM...`);
           const correctionPrompt = this._getCorrectionPrompt(validationErr.message, expectedContext);
           try {
             const correctionResponse = await llmProvider.generate(systemPrompt, userPrompt + "\n\n" + correctionPrompt, symbol);
             currentResponseText = correctionResponse.text;
             // Overwrite response metadata to reflect final success metric if successful
             response.metadata = correctionResponse.metadata;
           } catch (retryErr) {
             console.error(`[LLMService][${symbol}] LLM call failed during correction: ${retryErr.message}`);
             return {
               success: false,
               data: null,
               error: {
                 code: "LLM_CALL_FAILED",
                 message: retryErr.message,
                 provider: response.provider,
                 ticker: symbol,
                 stage: "correction_generation"
               }
             };
           }
        }
        attempts++;
      }
    }

    // Failed after max corrections
    const errCode = finalError.message.includes("Invalid JSON") ? "LLM_JSON_PARSE_FAILED" : "FORECAST_VALIDATION_FAILED";
    return {
      success: false,
      data: null,
      error: {
        code: errCode,
        message: finalError.message,
        provider: response.provider,
        ticker: symbol,
        stage: "json_validation"
      }
    };
  }
}

export default new LLMService();
