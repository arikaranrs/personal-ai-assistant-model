from firebase import db
from ragmodel import ingest_document

docs = [
    {
        "id": "contract_law_101",
        "text": "Under the Indian Contract Act 1872, a breach of contract allows the injured party to claim damages. Specifically, Section 73 deals with compensation for loss or damage caused by breach of contract."
    },
    {
        "id": "property_law_202",
        "text": "The Transfer of Property Act 1882 regulates the transfer of property in India. It contains specific provisions regarding sales, mortgages, leases, and gifts of immovable property."
    }
]

print("Seeding test documents into Firestore...")
for doc in docs:
    ingest_document(doc["id"], doc["text"])

print("Done seeding Firestore!")
