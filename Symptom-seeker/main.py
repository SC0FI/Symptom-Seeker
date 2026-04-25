from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import os
import uuid
from typing import Dict
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv
from database import save_symptom, query_history

# Import the brain from your engine file
from engine import generate_triage_response, generate_conversation_summary 

load_dotenv()

# --- AUTH CONFIGURATION ---
SECRET_KEY = "HACKATHON_SECRET_KEY" # In production, use os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=60)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# --- APP SETUP ---
app = FastAPI()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    return user_id

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ... (your imports and auth config remain the same)

class SymptomInput(BaseModel):
    symptom: str

class UserInput(BaseModel):
    user_id: str  # Changed to str for flexibility (usernames/emails)
    password: str # This matches the field name below

class ConversationCreate(BaseModel):
    title: str

users_db = {} 
# conversations_db format: { user_id: { conversation_id: { "id": str, "title": str, "messages": list } } }
conversations_db: Dict[str, Dict[str, dict]] = {}
# active_conversations format: { user_id: conversation_id }
active_conversations: Dict[str, str] = {}

# --- ROUTES ---

@app.get("/")
def read_root():
    return {"Status": "Symptom Seeker API is live"}

@app.post("/triage")
async def get_triage(data: SymptomInput, current_user_id: str = Depends(get_current_user)):
    # Check for active conversation
    if current_user_id not in active_conversations:
        # Create a default conversation
        conv_id = str(uuid.uuid4())
        if current_user_id not in conversations_db:
            conversations_db[current_user_id] = {}
        conversations_db[current_user_id][conv_id] = {
            "id": conv_id,
            "title": "Default Conversation",
            "messages": [],
            "summary": "No summary yet.",
            "symptoms": []
        }
        active_conversations[current_user_id] = conv_id
        
    active_id = active_conversations[current_user_id]
    conversation = conversations_db[current_user_id][active_id]

    # Append user message
    conversation["messages"].append({
        "role": "user",
        "content": data.symptom,
        "timestamp": datetime.now().isoformat()
    })

    # 1. Search Vector DB for similar past issues for THIS user
    past_symptoms = query_history(current_user_id, data.symptom)
    history_str = "\n".join(past_symptoms) if past_symptoms else "No previous history."

    # 2. Call Gemini with the context of their history
    ai_advice = await generate_triage_response(data.symptom, history_str)
    
    # 3. Save the NEW symptom so the DB stays updated
    save_symptom(current_user_id, data.symptom)
    
    # Append AI message
    conversation["messages"].append({
        "role": "ai",
        "content": ai_advice,
        "timestamp": datetime.now().isoformat()
    })
    
    return {"recommendation": ai_advice, "conversation_id": active_id}

@app.post("/conversations")
async def create_conversation(data: ConversationCreate, current_user_id: str = Depends(get_current_user)):
    conv_id = str(uuid.uuid4())
    if current_user_id not in conversations_db:
        conversations_db[current_user_id] = {}
        
    conversations_db[current_user_id][conv_id] = {
            "id": conv_id,
            "title": data.title, # Or "Default Conversation" in the triage route
            "messages": [],
            "summary": "No summary yet.", # NEW
            "symptoms": []                # NEW
        }
    active_conversations[current_user_id] = conv_id
    return {"conversation_id": conv_id, "title": data.title}

@app.get("/conversations")
async def get_conversations(current_user_id: str = Depends(get_current_user)):
    user_convs = conversations_db.get(current_user_id, {})
    active_id = active_conversations.get(current_user_id)
    return {
        "active_conversation_id": active_id,
        "conversations": [{"id": cid, "title": c["title"]} for cid, c in user_convs.items()]
    }

@app.put("/conversations/{conversation_id}/active")
async def set_active_conversation(conversation_id: str, current_user_id: str = Depends(get_current_user)):
    user_convs = conversations_db.get(current_user_id, {})
    if conversation_id not in user_convs:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    active_conversations[current_user_id] = conversation_id
    return {"message": f"Conversation {conversation_id} is now active"}

@app.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, current_user_id: str = Depends(get_current_user)):
    user_convs = conversations_db.get(current_user_id, {})
    if conversation_id not in user_convs:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    return user_convs[conversation_id]

@app.post("/conversations/{conversation_id}/summarize")
async def summarize_conversation(conversation_id: str, current_user_id: str = Depends(get_current_user)):
    user_convs = conversations_db.get(current_user_id, {})
    
    # 1. Verify the conversation exists
    if conversation_id not in user_convs:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    conversation = user_convs[conversation_id]
    messages = conversation.get("messages", [])
    
    # 2. Prevent summarizing empty chats
    if not messages:
        raise HTTPException(status_code=400, detail="Not enough messages to summarize.")
        
    # 3. Call the AI engine to generate the data
    extraction = await generate_conversation_summary(messages)
    
    # 4. Store the results in your dictionary database
    conversation["summary"] = extraction.get("summary", "")
    conversation["symptoms"] = extraction.get("symptoms", [])
    conversation["recommended_action"] = extraction.get("recommended_action", "No recommended action.") # <-- NEW
    
    return {
        "message": "Conversation summarized successfully",
        "conversation_id": conversation_id,
        "summary": conversation["summary"],
        "symptoms": conversation["symptoms"],
        "recommended_action": conversation["recommended_action"] # <-- NEW
    }

@app.get("/me")
async def read_users_me(current_user_id: str = Depends(get_current_user)):
    return {"user_id": current_user_id}

@app.post("/signup")
async def signup(data: UserInput): 
    # FIX: Use data.password instead of data.symptom
    hashed = hash_password(data.password) 
    users_db[data.user_id] = hashed
    return {"message": "User created"}

@app.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user_hash = users_db.get(form_data.username)
    if not user_hash or not verify_password(form_data.password, user_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    token = create_access_token({"sub": form_data.username})
    return {"access_token": token, "token_type": "bearer"}