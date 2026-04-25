import os
import chromadb
from chromadb.utils import embedding_functions
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

# 1. Setup the Embedding Function using the new syntax requirements
gemini_ef = embedding_functions.GoogleGeminiEmbeddingFunction(
    model_name="gemini-embedding-2"
)

# 2. Initialize the Persistent Client 
client = chromadb.PersistentClient(path="./chroma_db")

# 3. Get or Create the Collection
collection = client.get_or_create_collection(
    name="patient_history", 
    embedding_function=gemini_ef
)

def save_symptom(user_id, symptom_text):
    """Saves a symptom with user metadata for filtering."""
    timestamp = datetime.now().isoformat()
    collection.add(
        documents=[symptom_text],
        metadatas=[{"user_id": user_id, "timestamp": timestamp}], 
        ids=[f"{user_id}_{os.urandom(4).hex()}"]
    )

def query_history(user_id, query_text, n_results=3):
    """Retrieves symptoms only for the specific user."""
    results = collection.query(
        query_texts=[query_text],
        n_results=n_results,
        where={"user_id": user_id} 
    )
    
    if not results['documents'] or not results['documents'][0]:
        return []
        
    formatted_history = []
    docs = results['documents'][0]
    metadatas = results.get('metadatas')
    meta_list = metadatas[0] if metadatas and metadatas[0] else [{}] * len(docs)
    
    for doc, meta in zip(docs, meta_list):
        timestamp = meta.get("timestamp", "Unknown date")
        if timestamp != "Unknown date":
            try:
                dt = datetime.fromisoformat(timestamp)
                timestamp = dt.strftime("%Y-%m-%d %H:%M:%S")
            except ValueError:
                pass
        formatted_history.append(f"[{timestamp}] {doc}")
        
    return formatted_history