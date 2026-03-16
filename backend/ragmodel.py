import numpy as np # pyre-ignore[21]
from sentence_transformers import SentenceTransformer, util # pyre-ignore[21]
from langchain_text_splitters import RecursiveCharacterTextSplitter # pyre-ignore[21]
from firebase import db # pyre-ignore[21]
import chromadb # pyre-ignore[21]

# ==========================================
# RAG PIPELINE: CHROMA DB RETRIEVAL & EMBEDDING
# ==========================================

print("Initializing Embedding Model BAAI/bge-small-en...")
try:
    embedding_model = SentenceTransformer("BAAI/bge-small-en")
except Exception as e:
    print(f"Error loading embedding model: {e}")
    embedding_model = None

# Initialize ChromaDB persistent client
chroma_client = chromadb.PersistentClient(path="./data/chromadb")
collection = chroma_client.get_or_create_collection(name="legal_documents")

def sync_chroma_from_firebase():
    """Syncs existing Firebase legal_documents to ChromaDB on startup if empty."""
    if embedding_model is None or db is None:
        return
    existing_count = collection.count()
    if existing_count > 0:
        print(f"ChromaDB already has {existing_count} documents. Skipping sync.")
        return
        
    print("Syncing ChromaDB with Firebase Firestore...")
    docs = db.collection('legal_documents').stream()
    for doc in docs:
        data = doc.to_dict()
        text = data.get('content')
        source = data.get('source', 'unknown')
        chunk_id = data.get('chunk_id', 0)
        
        if text:
            # Generate embedding and add to ChromaDB
            embedding = embedding_model.encode(text).tolist()
            collection.add(
                documents=[text],
                embeddings=[embedding],
                metadatas=[{"source": source, "chunk_id": chunk_id}],
                ids=[doc.id]
            )
    print(f"Synced {collection.count()} documents to ChromaDB.")

# Run sync on startup
sync_chroma_from_firebase()

# Text Splitter Setup
splitter = RecursiveCharacterTextSplitter(
    chunk_size=600,
    chunk_overlap=100
)

def ingest_document(doc_id, text, metadata=None):
    """
    Chunks text, stores it in Firebase Firestore, and embeds it into ChromaDB.
    """
    if db is None or embedding_model is None or text is None:
        print(f"Skipping ingest: Firestore/Model missing or text empty for {doc_id}")
        return False
        
    chunks = splitter.split_text(text)
    if not chunks:
        return False
        
    print(f"Ingesting {doc_id} into {len(chunks)} chunks in Firestore & ChromaDB...")
    batch = db.batch()
    docs_ref = db.collection('legal_documents')
    
    for i, chunk in enumerate(chunks):
        chunk_doc_id = f"{doc_id}_{i}"
        
        # 1. Firebase Write
        doc_ref = docs_ref.document(chunk_doc_id)
        meta = {"source": doc_id, "chunk_id": i, "content": chunk}
        if metadata:
            meta.update(metadata)
        batch.set(doc_ref, meta)
        
        # 2. ChromaDB Write
        embedding = embedding_model.encode(chunk).tolist()
        collection.add(
            documents=[chunk],
            embeddings=[embedding],
            metadatas=[meta],
            ids=[chunk_doc_id]
        )
        
    batch.commit()
    print(f"Document {doc_id} indexed successfully in Firestore & ChromaDB.")
    return True

def retrieve_context(query, n_results=5):
    """
    Retrieves the most semantic matching chunks from ChromaDB.
    """
    if embedding_model is None:
        return ""
        
    try:
        # Embed query
        query_vector = embedding_model.encode(query).tolist()
        
        # Query ChromaDB
        results = collection.query(
            query_embeddings=[query_vector],
            n_results=n_results
        )
        
        documents = results.get('documents')
        if documents and len(documents) > 0 and documents[0]:
            retrieved_chunks = documents[0]
            print(f"Retrieved {len(retrieved_chunks)} semantic chunks from ChromaDB for context.")
            return "\n\n".join(retrieved_chunks)
            
    except Exception as e:
        print(f"ChromaDB RAG Retrieval Error: {e}")
        
    return ""
