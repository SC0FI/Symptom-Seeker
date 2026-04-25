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
    title: str
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
    1.1 Be very careful of reccomending 911 services, they are expensive and if not absoloutely neccessary, should be avoided.
    2. If not an emergency, suggest the most relevant specialist (e.g., Dermatologist, ENT, GP)
    2.1 Do NOT suggest seeing a gp unless the symptoms are very vague and minor. Try to reccomend a specialist first.
    2.2 If the users symptoms are common in younger people, suggest a pediatrician instead of a gp.
    2.3 If the Symptoms are vague, ask for more information or reccomend rest, do NOT refer them to a specialist for vague symptoms such as headache, back pain, etc.
    4. Keep the tone professional but empathetic.
    5. keep responses brief, yet informational
    6. do not repeat what the user has specified.
    7. Ask a follow up question to get a better understanding of the symptoms if you are not sure about the diagnosis. Only ask one follow up question at a time.
    8. A great question to ask is how long the symptoms have been going on for. this provides important context. 
    9. Do not diagnose the user, simply suggest the most relevant specialist (e.g., Dermatologist, ENT, GP).
    10. If you beleive the user has a history of a specific condition, be sure that it is indeed a history, and mentions are spread out, before repeating it as history. eg (A user presents with foot pain and mentions it 10 times in one day. This user does not have a history of foot pain and should not be told so. If a user mentions they have foot pain spread across multiple days or weeks, it can be considred history)
    11. After giving previously giving a reccomendation for a specialist, be careful in changing which specialist they should see.
    """
    
    # New async call syntax via client.aio
    response = await client.aio.models.generate_content(
        model='gemini-2.5-flash-lite',
        contents=prompt
    )
    return response.text

async def generate_triage_response_ignore_history(symptom_text):
    prompt = f"""
    You are a medical triage assistant. 
    Current Symptom: {symptom_text}
    
    Instructions:
    1. Assess if this is an emergency (tell them to call 911 if so) if 911 is not needed, do not mention 911 or emergencies.
    1.1 Be very careful of reccomending 911 services, they are expensive and if not need, should be avoided.
    2. If not an emergency, suggest the most relevant specialist (e.g., Dermatologist, ENT, GP)
    2.1 Do NOT suggest seeing a gp unless the symptoms are very vague and minor. Try to reccomend a specialist first.
    2.2 If the users symptoms are common in younger people, suggest a pediatrician instead of a gp.
    2.3 If the Symptoms are vague, ask for more information or reccomend rest, do NOT refer them to a specialist for vague symptoms such as headache, back pain, etc.
    4. Keep the tone professional but empathetic.
    5. keep responses brief, yet informational
    6. do not repeat what the user has specified.
    """
    
    response = await client.aio.models.generate_content(
        model='gemini-2.5-flash-lite',
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
    1. A short, descriptive title for the conversation based on the summary (max 5 words).
    2. A brief summary of the patient's overall issue (1-2 sentences).
    3. A definitive list of all specific medical symptoms mentioned by the patient.
    4. Where the triage assistant recommended the patient should go (e.g., "Call 911", "See a Dermatologist", "Rest at home", etc.)
    
    Conversation History:
    {chat_text}
    """
    
    response = await client.aio.models.generate_content(
        model='gemini-2.5-flash-lite',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ConversationSummary,
        )
    )
    
    return json.loads(response.text)