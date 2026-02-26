
CATEGORIES = {
    "Earnings & Financials": ["earnings", "revenue", "profit", "margin", "eps", "financial", "quarterly", "forecast", "guidance", "balance sheet", "net income", "sales", "dividend"],
    "Operations & Deliveries": ["production", "delivery", "deliveries", "factory", "plant", "operations", "supply chain", "logistics", "manufacturing", "inventory", "gigafactory"],
    "Regulation & Legal": ["lawsuit", "sued", "regulation", "regulator", "court", "legal", "compliance", "ban", "investigation", "fines", "recall", "safety", "sec"],
    "Innovation / AI / Growth": ["ai", "artificial intelligence", "innovation", "technology", "tech", "growth", "expansion", "new product", "launch", "robot", "fsd", "autopilot", "optimus", "dojo", "cybercab"],
    "Energy & Growth": ["energy", "solar", "battery", "storage", "expansion", "megapack", "powerwall", "renewable", "clean energy"],
    "Competition & Market Pressure": ["competition", "rival", "competitor", "market share", "price cut", "pressure", "macro", "inflation", "rates", "interest rate", "demand", "analyst", "downgrade", "upgrade", "price target"],
    "Management & Strategy": ["ceo", "management", "strategy", "executive", "board", "hire", "fire", "layoff", "shareholder", "vote", "acquisition", "merger"]
}

def categorize_news(articles):
    """
    Categorizes a list of articles.
    Adds a 'category' field to each article object.
    Returns the grouped dictionary for easier summary generation.
    """
    grouped = {k: [] for k in CATEGORIES.keys()}
    grouped["General"] = []
    
    for article in articles:
        text_lower = (article['title'] + " " + article['summary']).lower()
        assigned = False
        
        for category, keywords in CATEGORIES.items():
            for keyword in keywords:
                if keyword in text_lower:
                    article['category'] = category
                    grouped[category].append(article)
                    assigned = True
                    break
            if assigned:
                break
        
        if not assigned:
            article['category'] = "General"
            grouped["General"].append(article)
            
    return grouped

if __name__ == "__main__":
    mock_articles = [{"title": "Tesla Earnings Beat", "summary": "Revenue up 10%"}, {"title": "New Robot Unveiled", "summary": "Optimus is here"}]
    print(categorize_news(mock_articles))
