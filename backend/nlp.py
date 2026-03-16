# ==========================================
# NLP PROCESSING LAYER
# ==========================================
import spacy # pyre-ignore[21]
import sys
import subprocess

# Auto-download model if not present
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print("Downloading spacy en_core_web_sm model...")
    subprocess.check_call([sys.executable, "-m", "spacy", "download", "en_core_web_sm"])
    nlp = spacy.load("en_core_web_sm")

def process_query(query):
    """
    Extracts entities and keyword nouns from the query.
    """
    if not query:
        return {"entities": [], "keywords": []}
        
    doc = nlp(query)
    entities = [ent.text for ent in doc.ents]
    keywords = [token.text for token in doc if token.pos_ == "NOUN"]
    
    return {
        "entities": list(set(entities)),
        "keywords": list(set(keywords))
    }
