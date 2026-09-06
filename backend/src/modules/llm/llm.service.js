import llmProvider, { LLM_ERRORS } from "./llm.provider.js";

class LLMService {
  
  _buildCompactContext(researchContext) {
    const { symbol, market, historical, technicals, news, models } = researchContext;

    // Compact News: only validated/high-impact/relevant events
    const compactNews = (news?.articles || [])
      .filter(n => n.relevance_score > 0.5 || n.impact_score > 0.5)
      .map(n => ({
        eventId: n.eventClusterId || n.id,
        date: n.publishedDate,
        summary: n.headline || n.summary,
        sentiment: n.finbert_sentiment,
        impact: n.impact_score,
        relevance: n.relevance_score,
        evidence_id: n.id
      }))
      .slice(0, 15); // limit to top 15 events

    return {
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
      fundamentals: market, // only available passed from research
      news: compactNews,
      models: models
    };
  }

  _getSystemPrompt(symbol) {
    return `
You are the final forecasting layer of AcuTrader. 
Analyze exactly ONE ticker: ${symbol}.

CRITICAL RULES:
1. You ARE responsible for generating the final numerical forecast. Use the supplied market, technical, fundamental, and news context to generate price targets, probabilities, expected return, and confidence.
2. Generate forecasts for the next three supplied trading dates.
3. Probabilities must be between 0 and 1 and sum to 1.
4. Expected price, scenario targets, and expected return must be numerically generated based on the supplied context and consistent with the reference price.
5. expected_return_percent ≈ ((expected_price - reference_price) / reference_price) * 100
6. Confidence must be between 0 and 1.
7. Use ONLY supplied context. Do not invent source market/news data. Do not use external company knowledge.
8. News claims must reference supplied evidence IDs.
9. Preserve contradictory evidence.

Return valid JSON only. No markdown. No code fences.

Your JSON must exactly follow the required structure:
{
  "symbol": "${symbol}",
  "asOf": "ISO date",
  "status": "ready|partial|insufficient_data",
  "data_validation": { "issues": [] },
  "news_regime": "bullish|neutral|bearish|mixed",
  "news_summary": { "weighted_sentiment": null, "material_events": [] },
  "market_context": {},
  "technical_context": {},
  "fundamental_context": {},
  "model_context": {
    "xgboost": { "available": false, "output": null },
    "downstream_model": { "available": false, "output": null },
    "model_agreement": "unavailable",
    "model_disagreements": []
  },
  "news_market_interaction": {},
  "forecast": {
    "day_1": {
      "date": "YYYY-MM-DD",
      "direction": "bullish|neutral|bearish",
      "probabilities": { "bull_case": 0.0, "neutral_case": 0.0, "bear_case": 0.0 },
      "expected_price": null,
      "expected_return_percent": null,
      "scenarios": {
        "bull": { "target": null, "drivers": [], "evidence_ids": [] },
        "base": { "target": null, "drivers": [], "evidence_ids": [] },
        "bear": { "target": null, "drivers": [], "evidence_ids": [] }
      },
      "key_drivers": [], "risk_flags": [], "confidence": null, "evidence_ids": []
    },
    "day_2": { /* identical structure to day_1 */ },
    "day_3": { /* identical structure to day_1 */ }
  },
  "overall_assessment": {},
  "evidence": []
}
    `.trim();
  }

  _getCorrectionPrompt(errorMsg) {
    return `Your previous JSON output failed validation with the following error: ${errorMsg}\n\nPlease correct the JSON and return valid JSON only. No markdown.`;
  }

  _validateJSON(jsonObj, symbol) {
    if (jsonObj.symbol !== symbol) {
      throw new Error(`Symbol mismatch: expected ${symbol}, got ${jsonObj.symbol}`);
    }
    if (!jsonObj.forecast || !jsonObj.forecast.day_1 || !jsonObj.forecast.day_2 || !jsonObj.forecast.day_3) {
      throw new Error("Missing day_1, day_2, or day_3 in forecast");
    }
    
    // Check probabilities
    for (const day of ['day_1', 'day_2', 'day_3']) {
      const f = jsonObj.forecast[day];
      if (f.date === undefined) throw new Error(`Missing date for ${day}`);
      const p = f.probabilities;
      if (p) {
        const sum = (p.bull_case || 0) + (p.neutral_case || 0) + (p.bear_case || 0);
        if (Math.abs(sum - 1.0) > 0.05) {
          throw new Error(`Probabilities for ${day} do not sum to 1 (sum: ${sum})`);
        }
      }
    }
  }

  async synthesizeContext(symbol, researchContext) {
    const compactContext = this._buildCompactContext(researchContext);
    const systemPrompt = this._getSystemPrompt(symbol);
    const userPrompt = `Compact Context:\n${JSON.stringify(compactContext, null, 2)}`;

    let response;
    try {
      response = await llmProvider.generate(systemPrompt, userPrompt, symbol);
    } catch (err) {
      return {
        success: false,
        data: null,
        error: {
          code: err.type || "UNKNOWN_LLM_ERROR",
          message: err.message,
          provider: err.provider,
          ticker: symbol,
          stage: "llm_generation"
        }
      };
    }

    // Try parsing and validation
    let parsedResult;
    try {
      const jsonStr = response.text.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsedResult = JSON.parse(jsonStr);
      this._validateJSON(parsedResult, symbol);
    } catch (validationErr) {
      console.warn(`[LLMService][${symbol}] JSON Validation failed: ${validationErr.message}. Attempting correction...`);
      try {
        const correctionPrompt = this._getCorrectionPrompt(validationErr.message);
        const correctionResponse = await llmProvider.generate(systemPrompt, userPrompt + "\n\n" + correctionPrompt, symbol);
        const jsonStr = correctionResponse.text.replace(/```json/gi, "").replace(/```/g, "").trim();
        parsedResult = JSON.parse(jsonStr);
        this._validateJSON(parsedResult, symbol);
        // Overwrite response metadata
        response.metadata = correctionResponse.metadata;
      } catch (retryErr) {
        console.error(`[LLMService][${symbol}] JSON Validation failed on retry: ${retryErr.message}`);
        return {
          success: false,
          data: null,
          error: {
            code: "SCHEMA_VALIDATION_ERROR",
            message: retryErr.message,
            provider: response.provider,
            ticker: symbol,
            stage: "json_validation"
          }
        };
      }
    }

    return {
      success: true,
      data: parsedResult,
      metadata: response.metadata
    };
  }
}

export default new LLMService();
