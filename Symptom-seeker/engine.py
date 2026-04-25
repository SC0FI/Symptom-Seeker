import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-2.5-flash') # Using flash for speed

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
    
    response = await model.generate_content_async(prompt)
    return response.text