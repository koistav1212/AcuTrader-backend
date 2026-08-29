const POSITIVE_WORDS = ['surge', 'soar', 'jump', 'gain', 'profit', 'upgrade', 'buy', 'growth', 'beat', 'exceed', 'up', 'bullish', 'strong', 'positive', 'success', 'dividend', 'deal', 'partnership'];
const NEGATIVE_WORDS = ['plunge', 'drop', 'fall', 'loss', 'downgrade', 'sell', 'miss', 'down', 'bearish', 'weak', 'negative', 'fail', 'lawsuit', 'investigation', 'scandal', 'debt', 'bankruptcy', 'cut'];
const INTENT_CATEGORIES = {
  earnings: ['earnings', 'revenue', 'profit', 'eps', 'guidance', 'q1', 'q2', 'q3', 'q4', 'financial'],
  product: ['launch', 'release', 'new', 'product', 'update', 'feature', 'announce'],
  management: ['ceo', 'cfo', 'executive', 'board', 'hire', 'fire', 'step down', 'resign'],
  legal: ['lawsuit', 'sue', 'court', 'sec', 'investigation', 'patent', 'settlement'],
  macro: ['fed', 'interest rate', 'inflation', 'cpi', 'economy', 'gdp', 'job']
};

export function analyzeNewsSentiment(article) {
  const text = ((article.headline || '') + ' ' + (article.summary || '')).toLowerCase();
  
  let posCount = 0;
  let negCount = 0;
  
  POSITIVE_WORDS.forEach(word => {
    if (text.includes(word)) posCount++;
  });
  
  NEGATIVE_WORDS.forEach(word => {
    if (text.includes(word)) negCount++;
  });
  
  let sentimentScore = 0;
  let sentimentLabel = 'Neutral';
  
  if (posCount > negCount) {
    sentimentScore = Math.min((posCount - negCount) * 0.2, 1.0);
    sentimentLabel = 'Bullish';
  } else if (negCount > posCount) {
    sentimentScore = Math.max((posCount - negCount) * 0.2, -1.0);
    sentimentLabel = 'Bearish';
  }
  
  let category = 'general';
  let maxMatches = 0;
  
  for (const [cat, keywords] of Object.entries(INTENT_CATEGORIES)) {
    let matches = 0;
    keywords.forEach(kw => {
      if (text.includes(kw)) matches++;
    });
    if (matches > maxMatches) {
      maxMatches = matches;
      category = cat;
    }
  }
  
  // Calculate a basic semantic/relevance score based on symbol mention in headline vs summary
  let semanticScore = 0.5; 
  if (article.symbol) {
    const sym = article.symbol.toLowerCase();
    if ((article.headline || '').toLowerCase().includes(sym)) semanticScore += 0.3;
    if ((article.summary || '').toLowerCase().includes(sym)) semanticScore += 0.2;
  }
  semanticScore = Math.min(semanticScore, 1.0);
  
  // Impact is higher if there are more positive/negative keywords or specific intents
  const impactScore = Math.min((posCount + negCount + maxMatches) * 0.15, 1.0);
  
  return {
    sentimentScore: parseFloat(sentimentScore.toFixed(2)),
    sentimentLabel,
    semanticScore: parseFloat(semanticScore.toFixed(2)),
    impactScore: parseFloat(impactScore.toFixed(2)),
    category
  };
}

export function aggregateSentiment(articles = []) {
  if (articles.length === 0) return {};
  
  let totalScore = 0;
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  let totalImpact = 0;
  
  articles.forEach(a => {
    totalScore += a.sentimentScore || 0;
    totalImpact += a.impactScore || 0;
    if (a.sentimentLabel === 'Bullish') bullish++;
    else if (a.sentimentLabel === 'Bearish') bearish++;
    else neutral++;
  });
  
  const avgScore = totalScore / articles.length;
  let overallLabel = 'Neutral';
  if (avgScore >= 0.1) overallLabel = 'Bullish';
  else if (avgScore <= -0.1) overallLabel = 'Bearish';
  
  return {
    averageScore: parseFloat(avgScore.toFixed(2)),
    overallVerdict: overallLabel,
    averageImpact: parseFloat((totalImpact / articles.length).toFixed(2)),
    articleCount: articles.length,
    breakdown: {
      bullish,
      bearish,
      neutral
    }
  };
}
