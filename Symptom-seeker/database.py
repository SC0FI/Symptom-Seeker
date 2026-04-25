import os
import chromadb
from chromadb.utils import embedding_functions
from dotenv import load_dotenv

load_dotenv()

# 1. Setup the Gemini Embedding Function
# This converts text into vectors that the database can search
gemini_ef = embedding_functions.GoogleGeminiEmbeddingFunction(
    api_key=os.getenv("GEMINI_API_KEY"),
    model_name="models/text-embedding-004"
)

# 2. Initialize the Persistent Client 
# The 'path' is where the database files will be stored on your disk
client = chromadb.PersistentClient(path="./chroma_db")

# 3. Get or Create the Collection
# A collection is like a table in a traditional database
collection = client.get_or_create_collection(
    name="patient_history", 
    embedding_function=gemini_ef
)

def save_symptom(user_id, symptom_text):
    """Saves a symptom to the user's history."""
    collection.add(
        documents=[symptom_text],
        ids=[f"{user_id}_{os.urandom(4).hex()}"] # Create a unique ID
    )

def query_history(query_text, n_results=3):
    """Retrieves the most relevant past symptoms."""
    results = collection.query(
        query_texts=[query_text],
        n_results=n_results
    )
    return results['documents'][0] if results['documents'] else []