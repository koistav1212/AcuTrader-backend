import torch
import numpy as np
from sentence_transformers import SentenceTransformer

_embedding_model = None

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
        try:
            _embedding_model = SentenceTransformer('all-MiniLM-L6-v2', device=device)
        except Exception as e:
            print(f"Failed to load sentence-transformer on {device}, falling back to cpu: {e}")
            _embedding_model = SentenceTransformer('all-MiniLM-L6-v2', device='cpu')
    return _embedding_model

def generate_embeddings(articles, symbol="NVDA"):
    """
    Generates sentence embeddings for a list of articles.
    Computes semantic_relevance_score and event_category using cosine similarity.
    Modifies the list in place by adding fields.
    """
    if not articles:
        return articles
        
    model = get_embedding_model()
    
    texts = []
    for a in articles:
        t = a.get('title', '')
        s = a.get('summary', '')
        texts.append(f"{t}. {s}")
        
    embeddings = model.encode(texts, convert_to_numpy=True)
    
    # Compute relevance to the target symbol
    target_text = f"{symbol} stock, financial performance, business operations, material events"
    target_embedding = model.encode([target_text], convert_to_numpy=True)[0]
    target_norm = np.linalg.norm(target_embedding)
    
    # Define categories for classification via embedding similarity
    categories = [
        "earnings", "guidance", "analyst", "product", "partnership", 
        "customer_demand", "regulation", "export_control", "legal", 
        "management", "capital_allocation", "macro", "competition", "supply_chain"
    ]
    cat_embeddings = model.encode(categories, convert_to_numpy=True)
    cat_norms = np.linalg.norm(cat_embeddings, axis=1)
    
    for i, a in enumerate(articles):
        emb = embeddings[i]
        emb_norm = np.linalg.norm(emb)
        
        # Semantic Relevance
        if emb_norm > 0 and target_norm > 0:
            sim = np.dot(emb, target_embedding) / (emb_norm * target_norm)
            relevance = max(0.0, min(float(sim), 1.0))
        else:
            relevance = 0.5
            
        # Category Classification
        best_cat = "other"
        best_sim = 0.25 # Threshold
        if emb_norm > 0:
            for j, cat_emb in enumerate(cat_embeddings):
                if cat_norms[j] > 0:
                    sim = np.dot(emb, cat_emb) / (emb_norm * cat_norms[j])
                    if sim > best_sim:
                        best_sim = sim
                        best_cat = categories[j]
        
        a['embedding'] = emb.tolist()
        a['embedding_model'] = 'all-MiniLM-L6-v2'
        a['embedding_dimension'] = len(emb)
        a['semantic_relevance_score'] = relevance
        a['event_category'] = best_cat
        
    return articles
