import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import List

load_dotenv()

# Configure the new Gemini Client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Define the exact structure we want from Gemini for summaries
class ConversationSummary(BaseModel):
    summary: str
    symptoms: List[str]
    recommended_action: str

async def generate_triage_response(symptom_text, history_context=""):
    prompt = f"""
    You are a medical triage assistant. 
    Past History: {history_context}
    Current Symptom: {symptom_text}
    
    Instructions:
    1. Assess if this is an emergency (tell them to call 911 if so) if 911 is not needed, do not mention 911 or emergencies.
    1.1 Be very careful of reccomending 911 services, they are expensive and if not need, should be avoided.
    2. If not an emergency, suggest the most relevant specialist (e.g., Dermatologist, ENT, GP)
    3. Do NOT refer them to a specialist for vague symptoms such as headache, ask for more info or reccomend rest.
    4. Keep the tone professional but empathetic.
    5. keep responses brief, yet informational
    6. do not repeat what the user has specified.
    """
    
    # New async call syntax via client.aio
    response = await client.aio.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt
    )
    return response.text

async def generate_conversation_summary(messages: list) -> dict:
    """Reads a chat history and extracts a summary, symptom list, and recommendation."""
    # We will make the roles more descriptive for Gemini
    chat_text = "\n".join([f"{'Patient' if m['role'] == 'user' else 'AI Triage Assistant'}: {m['content']}" for m in messages])
    
    prompt = f"""
    Analyze the following medical triage conversation.
    Extract:
    1. A brief summary of the patient's overall issue (1-2 sentences).
    2. A definitive list of all specific medical symptoms mentioned by the patient.
    3. Where the triage assistant recommended the patient should go (e.g., "Call 911", "See a Dermatologist", "Rest at home", etc.)
    
    Conversation History:
    {chat_text}
    """
    
    response = await client.aio.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ConversationSummary,
        )
    )
    
    return json.loads(response.text)