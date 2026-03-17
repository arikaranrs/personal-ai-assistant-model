import os
from groq import Groq

def generate_response(prompt, context, nlp_info):
    """
    Streams a response from the Groq Llama 3.1 API.
    """
    try:
        # Initialize the Groq client. It will automatically look for the GROQ_API_KEY we set later.
        client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

        # Build the system instructions using your RAG context
        system_prompt = (
            "You are a highly intelligent and helpful Legal AI Companion focused on Indian Law. "
            "Use the provided context to answer the user's query accurately. "
            f"\n\nContext:\n{context}\n\nNLP Analysis:\n{nlp_info}"
        )

        # Call the blazing fast Groq API
        stream = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.1-8b-instant", 
            stream=True,
        )

        # Yield the chunks back to app.py exactly how it expects them
        for chunk in stream:
            if chunk.choices[0].delta.content is not None:
                yield chunk.choices[0].delta.content
                
    except Exception as e:
        error_msg = f"\n[AI Engine Error] Failed to connect to Groq: {str(e)}"
        print(error_msg)
        yield error_msg