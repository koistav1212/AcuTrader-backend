import torch
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

def generate_embeddings(articles):
    """
    Generates sentence embeddings for a list of articles.
    Modifies the list in place by adding an 'embedding' key.
    Returns the modified list.
    """
    if not articles:
        return []
        
    model = get_embedding_model()
    
    texts = []
    for a in articles:
        # Combine title and summary for rich embedding
        t = a.get('title', '')
        s = a.get('summary', '')
        texts.append(f"{t}. {s}")
        
    embeddings = model.encode(texts, convert_to_numpy=True)
    
    for i, a in enumerate(articles):
        a['embedding'] = embeddings[i].tolist()
        
    return articles
