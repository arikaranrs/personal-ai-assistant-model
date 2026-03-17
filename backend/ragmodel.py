from sentence_transformers import SentenceTransformer  # pyre-ignore[21]
from langchain_text_splitters import RecursiveCharacterTextSplitter  # pyre-ignore[21]
from firebase import db  # pyre-ignore[21]
import chromadb  # pyre-ignore[21]

# ==========================================
# RAG PIPELINE — ChromaDB + Firebase
# ==========================================

print("[RAG] Initializing embedding model BAAI/bge-small-en...")
try:
    embedding_model = SentenceTransformer("BAAI/bge-small-en")
    print("[RAG] Embedding model loaded.")
except Exception as e:
    print(f"[RAG] ERROR loading embedding model: {e}")
    embedding_model = None

# ChromaDB persistent client
chroma_client = chromadb.PersistentClient(path="./data/chromadb")
collection = chroma_client.get_or_create_collection(name="legal_documents")

# Text splitter
splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=100)


def _sync_chroma_from_firebase():
    """Sync Firebase legal_documents → ChromaDB on startup (only if ChromaDB is empty)."""
    if embedding_model is None or db is None:
        return
    if collection.count() > 0:
        print(f"[RAG] ChromaDB has {collection.count()} documents. Skipping sync.")
        return
    print("[RAG] Syncing ChromaDB from Firebase...")
    try:
        docs = db.collection("legal_documents").stream()
        count = 0
        for doc in docs:
            data = doc.to_dict()
            text = data.get("content")
            if text:
                embedding = embedding_model.encode(text).tolist()
                collection.add(
                    documents=[text],
                    embeddings=[embedding],
                    metadatas=[{"source": data.get("source", "unknown"), "chunk_id": data.get("chunk_id", 0)}],
                    ids=[doc.id],
                )
                count += 1
        print(f"[RAG] Synced {count} documents to ChromaDB.")
    except Exception as e:
        print(f"[RAG] Firebase sync error: {e}")


_sync_chroma_from_firebase()


def ingest_document(doc_id: str, text: str, metadata: dict = None) -> bool:
    """
    Chunks text → stores embeddings in ChromaDB, metadata in Firebase.
    """
    if embedding_model is None or not text:
        print(f"[RAG] Skipping ingest for {doc_id}: model or text missing.")
        return False

    chunks = splitter.split_text(text)
    if not chunks:
        return False

    print(f"[RAG] Ingesting '{doc_id}' → {len(chunks)} chunks...")
    batch = db.batch() if db else None
    docs_ref = db.collection("legal_documents") if db else None

    for i, chunk in enumerate(chunks):
        chunk_id = f"{doc_id}_{i}"
        meta = {"source": doc_id, "chunk_id": i, "content": chunk}
        if metadata:
            meta.update(metadata)

        # ChromaDB
        embedding = embedding_model.encode(chunk).tolist()
        try:
            collection.add(
                documents=[chunk],
                embeddings=[embedding],
                metadatas=[{"source": doc_id, "chunk_id": i}],
                ids=[chunk_id],
            )
        except Exception:
            # Already exists — update instead
            collection.update(
                documents=[chunk],
                embeddings=[embedding],
                metadatas=[{"source": doc_id, "chunk_id": i}],
                ids=[chunk_id],
            )

        # Firebase: metadata only (no embeddings)
        if batch and docs_ref:
            doc_ref = docs_ref.document(chunk_id)
            batch.set(doc_ref, {"source": doc_id, "chunk_id": i, "content": chunk})

    if batch:
        batch.commit()

    print(f"[RAG] '{doc_id}' indexed: {len(chunks)} chunks.")
    return True


def retrieve_context(query: str, n_results: int = 3) -> str:
    """
    Retrieves top-3 semantically relevant chunks from ChromaDB.
    Returns a merged string capped at ~1000 tokens.
    """
    if embedding_model is None:
        return ""

    try:
        query_vector = embedding_model.encode(query).tolist()
        results = collection.query(
            query_embeddings=[query_vector],
            n_results=min(n_results, max(collection.count(), 1)),
        )
        docs = results.get("documents", [[]])[0]
        if not docs:
            return ""

        combined = "\n\n".join(docs)
        # Cap at ~4000 chars (~1000 tokens)
        if len(combined) > 4000:
            combined = combined[:4000]

        print(f"[RAG] Retrieved {len(docs)} chunks ({len(combined)} chars).")
        return combined

    except Exception as e:
        print(f"[RAG] Retrieval error: {e}")
        return ""
