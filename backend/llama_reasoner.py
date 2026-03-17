import ollama  # pyre-ignore[21]
import sys
from typing import Optional

# ==========================================
# LLAMA LEGAL REASONING — Ollama llama3.1
# ==========================================

MODEL = "llama3.1"

print(f"[LlamaReasoner] Using Ollama model: {MODEL}")

# Attempt a quick connection check at startup
try:
    _models = ollama.list()
    _names = [m.model for m in _models.models] if hasattr(_models, 'models') else []
    if any(MODEL in n for n in _names):
        print(f"[LlamaReasoner] Model '{MODEL}' confirmed available in Ollama.")
    else:
        print(f"[LlamaReasoner] WARNING: '{MODEL}' not found in Ollama. Run: ollama pull {MODEL}")
except Exception as e:
    print(f"[LlamaReasoner] WARNING: Could not connect to Ollama: {e}")
    print(f"[LlamaReasoner] Make sure Ollama is running: ollama serve")


def _detect_language(text: str) -> str:
    """Detect language of text. Returns a language name for the prompt."""
    try:
        from langdetect import detect  # pyre-ignore[21]
        code = detect(text)
        lang_map = {
            "ta": "Tamil",
            "hi": "Hindi",
            "ml": "Malayalam",
            "kn": "Kannada",
            "gu": "Gujarati",
            "en": "English",
            "te": "Telugu",
            "mr": "Marathi",
            "bn": "Bengali",
        }
        return lang_map.get(code, "English")
    except Exception:
        return "English"


def _build_prompt(question: str, context: str, language: str) -> str:
    """Build the legal assistant prompt."""
    context_block = context.strip() if context and context.strip() else "No specific documents found. Use general Indian law knowledge."
    # Truncate context to max ~1200 tokens worth of chars (~4800 chars)
    if len(context_block) > 4800:
        context_block = context_block[:4800] + "\n...[context truncated]"  # type: ignore[index]

    return f"""You are an Indian Legal Assistant AI.
Your job is to provide accurate, structured, and helpful legal information.

STRICT RULES:
- Always answer the user's question clearly
- Use provided context if available
- If no context, use general Indian law knowledge
- Respond in {language}
- Be professional but simple and human-like
- Do NOT refuse or give generic AI disclaimers
- Do NOT say 'I am an AI model'
- Give direct answers with explanation

Context:
{context_block}

User Question:
{question}

Answer:"""


def generate_response(query: str, context: str = "", nlp_info: Optional[dict] = None):
    """
    Streaming generator: yields response text chunks from Ollama llama3.1.
    """
    language = _detect_language(query)
    prompt = _build_prompt(query, context, language)

    try:
        stream = ollama.chat(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
        )
        for chunk in stream:
            content = chunk.get("message", {}).get("content", "")
            if content:
                yield content

    except Exception as e:
        err = str(e)
        print(f"[LlamaReasoner] Generation error: {err}", file=sys.stderr)
        if "connection" in err.lower() or "refused" in err.lower():
            yield (
                "⚠️ Cannot connect to Ollama. "
                "Please make sure Ollama is running by executing: `ollama serve` "
                "and the model is available: `ollama pull llama3.1`"
            )
        else:
            yield f"⚠️ Error generating response: {err}"


def test_pipeline():
    """Quick end-to-end test of the full pipeline."""
    from ragmodel import retrieve_context  # pyre-ignore[21]
    print("\n=== PIPELINE TEST ===")
    q = "What is IPC 420?"
    print(f"Query: {q}")
    context = retrieve_context(q)
    print(f"Context retrieved: {len(context)} chars")
    print("Response:")
    result = ""
    for chunk in generate_response(q, context):
        result += chunk
        sys.stdout.write(chunk)
        sys.stdout.flush()
    print(f"\n\n=== DONE: {len(result)} chars ===")


if __name__ == "__main__":
    test_pipeline()
