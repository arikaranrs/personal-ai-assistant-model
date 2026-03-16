# ==========================================
# XTTS Voice Generation Layer
# ==========================================
import os
os.environ["COQUI_TOS_AGREED"] = "1"

print("Warning: TTS and langdetect modules are disabled due to Windows compilation errors in this environment.")
HAS_TTS = False
HAS_LANGDETECT = False
TTS = None
tts = None

# Fallback mapping from langdetect language codes to XTTS supported language codes
# XTTS supports: en, es, fr, de, it, pt, pl, tr, ru, nl, cs, ar, zh, hu, ko, ja
XTTS_SUPPORTED_LANGS = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'tr', 'ru', 'nl', 'cs', 'ar', 'zh', 'hu', 'ko', 'ja']

def generate_voice(text: str, filename: str = "response.wav") -> str | None:
    """
    Mocked voice generation. Returns None.
    """
    print(f"[XTTS] Mocked voice generation called for: {filename}")
    return None
