from fastapi import FastAPI
import chromadb
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai




app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For production, replace "*" with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"Status": "Symptom Seeker API is live"}