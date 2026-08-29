give prompt to focus & create a image for the new Hawkes Transformers layer only how the data is feeded into & what is the exact output for a sample stock NVEDIA 
Module 2 (Narrative & Sentiment Momentum via Hawkes / Transformers): They only display chronological article lists or basic binary (positive/negative) aggregations. They do not model arrival intensity, decay curves, or fine-grained aspect attribution.

Module 5 (Probabilistic Conformal Scenario Synthesizer): They provide no mathematically calibrated probabilistic distribution ($P_{10}, P_{50}, P_{90}$) or multi-source signal fusion with finite-sample confidence guarantees.

2. How to Incorporate News Insights to Measure Real Influence
To quantify how news moves the needle rather than just displaying text, use a 3-step quantitative pipeline:

Raw News Feed ──► FinBERT Embeddings ──► Hawkes Decay Engine ──► Feature Attribution (SHAP)
                        │                         │                            │
                        ▼                         ▼                            ▼
                 Financial Intent         Narrative Velocity            Probability Δ
               (e.g., Regulatory)         (Self-exciting drift)      (e.g., +14% Bull Shift)
Event Categorization & Polarity: Classify incoming news into specific financial intents (regulatory, earnings_guidance, litigation, capex) and calculate directional polarity.

Hawkes Process Decay (Narrative Velocity): Model news arrival intensity. High-impact clusters create a self-exciting shock that decays exponentially over a half-life $t_{1/2}$.

Signal Attribution (Delta Contribution): Calculate the marginal probability shift:

$$\Delta P(\text{Bull}) = P(\text{Bull} \mid \text{Technicals} + \text{Fundamentals} + \text{News}) - P(\text{Bull} \mid \text{Technicals} + \text{Fundamentals})$$
3. Data Specification: Input vs. Final Output
A. Input Data Payload
This is the structured payload ingested by your analytics engine:

JSON

{
  "symbol": "RELIANCE",
  "timestamp": "2026-08-23T03:30:00Z",
  "market_data": {
    "current_price": 2980.50,
    "rsi_14": 46.2,
    "macd_histogram": -1.45,
    "realized_vol_30d": 0.165
  },
  "fundamentals": {
    "pe_ratio": 24.8,
    "operating_margin_trend": "+0.012",
    "debt_to_equity": 0.38
  },
  "raw_news_feed": [
    {
      "headline": "Reliance Retail expands quick-commerce footprint across 40 new hubs",
      "source": "Financial Express",
      "published_at": "2026-08-22T18:15:00Z",
      "intent_hint": "expansion"
    },
    {
      "headline": "O2C segment margins face pressure amid soft global refining cracks",
      "source": "Reuters",
      "published_at": "2026-08-22T21:00:00Z",
      "intent_hint": "commodity_headwind"
    }
  ]
}
B. Final Output Payload (Engine Synthesis)
This is the unified research and probabilistic object consumed by your application:
JSON

{
  "symbol": "RELIANCE",
  "as_of": "2026-08-23T03:30:00Z",
  "market_regime": {
    "state": "SIDEWAYS_CONSOLIDATION",
    "transition_probability_to_expansion": 0.28,
    "volatility_regime": "LOW"
  },
  "news_intelligence": {
    "composite_sentiment_score": 0.24,
    "narrative_momentum": "ACCELERATING",
    "dominant_catalysts": [
      {
        "event_type": "SEGMENT_EXPANSION",
        "segment": "Retail",
        "impact_score": +0.38,
        "decay_half_life_hours": 36
      },
      {
        "event_type": "MARGIN_CONTRACTION",
        "segment": "Oil_to_Chemicals",
        "impact_score": -0.21,
        "decay_half_life_hours": 12
      }
    ]
  },
  "signal_attribution": {
    "technicals_contribution": -0.08,
    "fundamentals_contribution": +0.12,
    "news_sentiment_attribution": +0.18,
    "net_bias": "+0.22 (Constructive)"
  },
  "probabilistic_scenarios": {
    "bull_case": {
      "probability": 0.58,
      "price_target": 3120.00,
      "primary_driver": "Retail margin accretion outstripping O2C drag"
    },
    "base_case": {
      "probability": 0.30,
      "price_range": [2940.00, 3020.00],
      "primary_driver": "Range-bound consolidation"
    },
    "bear_case": {
      "probability": 0.12,
      "support_floor": 2860.00,
      "primary_driver": "Extended global refining margin slump"
    }
  },
  "actionable_levels": {
    "optimal_entry": 2960.00,
    "stop_loss": 2910.00,
    "take_profit": 3115.00,
    "conformal_confidence": 0.88
  }
}
Summary of System Value
CapabilityStatic Platforms (TradingView/Yahoo)Multi-Modal Quant EngineNews ProcessingChronological list of linksAspect-based sentiment + Event decay modelingSignal FusionManual trader eye-ballingConformal calibrated probabilities ($P_{\text{Bull}}, P_{\text{Base}}, P_{\text{Bear}}$)Causal AttributionNoneQuantified marginal impact of news vs. price action