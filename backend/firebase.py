# ==========================================
# FIREBASE CONFIGURATION
# ==========================================
import firebase_admin # pyre-ignore[21]
from firebase_admin import credentials, firestore # pyre-ignore[21]

# Initialize Firebase Admin using the service account key
# Prevents re-initialization error if imported multiple times
if not firebase_admin._apps:
    cred = credentials.Certificate('serviceAccountKey.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()
