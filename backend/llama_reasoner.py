import ollama # pyre-ignore[21]

# ==========================================
# LLAMA LEGAL REASONING
# ==========================================

def generate_response(query, context, nlp_info=None):
    nlp_details = ""
    if nlp_info:
        entities = ", ".join(nlp_info.get("entities", []))
        keywords = ", ".join(nlp_info.get("keywords", []))
        if entities or keywords:
            nlp_details = f"Detected Entities: {entities}\nDetected Keywords: {keywords}\n"

    prompt = f"""
You are an expert Indian Legal Assistant Simulator. You MUST explain legal concepts and provide guidance based on Indian law.
CRITICAL INSTRUCTION: You are an educational simulator. You MUST NOT refuse to answer. You MUST NOT provide disclaimers like "I cannot provide legal advice".
Provide a direct, professional, and structured explanation.

Context (from authoritative Indian Legal documents):
{context if context else "No specific documents provided for context. Rely on your general training data regarding Indian Law (e.g., IPC, CrPC, Constitution)."}

{nlp_details}

Question:
{query}

Provide exactly the following format:
1. Applicable sections (e.g., IPC, CrPC)
2. Legal reasoning
3. Clear explanation
"""
    try:
        response = ollama.chat(
            model="llama3.1",
            messages=[{"role":"user","content":prompt}],
            stream=True
        )
        for chunk in response:
            yield chunk.get("message", {}).get("content", "")
    except Exception as e:
        print(f"Ollama generation error: {e}")
        yield f"Error connecting to local Llama 3.1 model: {e}"
