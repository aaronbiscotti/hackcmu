from fastapi import FastAPI, Request, WebSocket, Response, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import json
import anthropic
from pydantic import BaseModel, Field
from typing import Dict, Optional, Any
import asyncio
import os
import time
import logging
import httpx
from vosk import Model, KaldiRecognizer
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor

# Load environment variables from .env file
load_dotenv()

# Import other python files
from Profiles import Profile
from Buddy import Buddy
from livekit_api import setup_livekit_routes


FILLER_WORDS = {"um", "uh", "like", "so", "you know", "actually", "basically", "literally", "well", "right"}

# Pydantic model for structured output
class ProfileState(BaseModel):
    profession: str = Field(..., description="Professional role/background")
    memory: Dict[str, str] = Field(..., description="Updated knowledge, assumptions, or insights")
    understanding_threshold: float = Field(..., ge=0, le=1, description="Minimum comprehension needed to stay engaged")
    wps: int = Field(..., ge=0, le=100, description="Words per second when speaking")
    filler_words: int = Field(..., ge=0, le=50, description="Number of filler words per minute when speaking")
    interest: float = Field(..., ge=0, le=1, description="Current interest level in the topic")
    confidence: float = Field(..., ge=0, le=1, description="Confidence in understanding of current discussion")

# Lifespan context manager for startup and shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global buddy, prompt_template, executor
    print("Backend server is starting up!")
    
    # Initialize ThreadPoolExecutor for audio processing
    executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="audio_processing")
    print("ThreadPoolExecutor initialized for audio processing")
    
    # Load the Vosk model in the background
    asyncio.create_task(load_vosk_model())
    
    try:
        with open("prompts/base.xml", "r") as f:
            prompt_template = f.read()
            print("Loaded prompt template")
    except Exception as e:
        print(f"Error loading prompt template: {e}")
        return
    
    buddy = Buddy()
    print("Buddy initialized")
    print("Ready to accept connections and create profiles dynamically")
    
    yield
    
    # Shutdown
    print("Backend server is shutting down.")
    if executor:
        executor.shutdown(wait=True)
        print("ThreadPoolExecutor shutdown complete")

app = FastAPI(lifespan=lifespan)

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for ngrok compatibility
    allow_credentials=False,  # Must be False when allow_origins is "*"
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Test endpoint to verify server is running updated code
@app.get("/test")
async def test_endpoint():
    return {"message": "Server updated successfully!", "timestamp": "2025-09-13-18:11"}

# Status endpoint to check if Vosk model is loaded
@app.get("/status")
async def status_endpoint():
    return {
        "server": "running",
        "vosk_model_loaded": vosk_model is not None,
        "executor_available": executor is not None,
        "active_sessions": len(active_sessions),
        "profiles": len(profiles_by_name)
    }

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# Setup LiveKit API routes
setup_livekit_routes(app)

# Constants
VOSK_MODEL_PATH = "vosk-model"
VOSK_SAMPLE_RATE = 16000
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"

# Global variables
profiles_by_name = {}  # Dictionary to store profiles by participant identity
active_sessions = {}   # Dictionary to store active WebSocket sessions
buddy = None
prompt_template = None
vosk_model = None  # Will be loaded asynchronously
executor = None  # ThreadPoolExecutor for audio processing

# LOGGING
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Asynchronous Vosk model loading
async def load_vosk_model():
    global vosk_model
    try:
        if not os.path.exists(VOSK_MODEL_PATH):
            logger.warning(f"Vosk model not found at {VOSK_MODEL_PATH}")
            return
        
        logger.info("Starting to load Vosk model asynchronously...")
        # Run the model loading in a thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        vosk_model = await loop.run_in_executor(None, Model, VOSK_MODEL_PATH)
        logger.info("Vosk model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load Vosk model: {e}")

# LLM helper
async def get_emotion_from_text(text: str, profile: Dict[str, Any]) -> str:
    if not text.strip():
        return "idle"

    headers = {
        "x-api-key": os.getenv("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }

    profile_context = json.dumps(profile, indent=2)
    prompt = (
        "Analyze the emotion of the following speech given the user's profile and memory. In addition, note that if wps is high (>= 5) we probably want to react with slow emotion, if filler is high (>= 4) we would probably want confused, etc.\n\n"
        f"Profile:\n{profile_context}\n\n"
        f"Text: '{text}'\n\n"
        "Respond with ONLY ONE word only from: idle, question, nodding, shaking_head, excited, thinking, confused, speaking, slow. "
        "Make sure there is ABSOLUTELY NO punctuation, extra words, newlines, etc. Note that the emotion should only change from the previous emotion that was provided around 40 percent of the time, with idle being a default state if it seems nothing is needed.\n\n"
    )

    payload = {
        "model": "claude-3-7-sonnet-20250219",
        "max_tokens": 10,
        "messages": [{"role": "user", "content": prompt}]
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(ANTHROPIC_API_URL, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            emotion = result.get('content', [{}])[0].get('text', 'speaking').strip().lower()
            logger.info(f"LLM emotion analysis: '{text}' with profile -> '{emotion}'")
            return emotion
    except Exception as e:
        logger.error(f"Emotion analysis error: {e}")
        return "speaking"

# TranscriptionService factory
def create_transcription_service(profile: Profile):
    from services import TranscriptionService
    try:
        if vosk_model is None:
            logger.warning("Vosk model not yet loaded, transcription service will not be available")
            return None
        return TranscriptionService(vosk_model, VOSK_SAMPLE_RATE, process_data, profile)
    except ValueError as e:
        logger.error(f"Cannot create transcription service: {e}")
        return None

# On server startup
def get_or_create_profile(identity: str) -> Profile:
    """Gets an existing profile or creates a new one for a user."""
    if identity in profiles_by_name:
        return profiles_by_name[identity]
    
    # Create a new default profile for the user
    print(f"Creating a new default profile for user: {identity}")
    new_profile = Profile(
        name=identity,
        profession="Participant",
        memory={"initial": "First time user in this session"},
        understanding_threshold=0.6,
        wps=3,
        filler_words=5,
        interest=0.7,
        confidence=0.6,
        current_emotion="idle"
    )
    
    profiles_by_name[identity] = new_profile
    print(f"Profile created for: {identity}")
    return new_profile


# Process data
async def process_data(data):
    global profiles_by_name, buddy, prompt_template
    print("Processing data:")

    profile_name, message, timestamp = parse_data(data)
    profile = profiles_by_name.get(profile_name)
    if not profile:
        print(f"Warning: Profile not found for {profile_name}")
        return {"emotion": "speaking"}
    print(f"Loaded profile: {profile}")

    emotion = "speaking"
    if profile is not None and prompt_template:
        # Calculate filler words from the current message
        words = message.lower().split()
        filler_count = sum(1 for word in words if word.strip('.,!?') in FILLER_WORDS)
        profile.filler_words = filler_count

        if profile.last_timestamp is not None and profile.last_message is not None:
            time_diff = timestamp - profile.last_timestamp
            if time_diff > 0:
                words_current = len(message.split())
                words_per_second = words_current / time_diff
                profile.wps = round(words_per_second)
                print(f"Calculated WPS: {profile.wps}")

        profile.last_message = message
        profile.last_timestamp = timestamp

        previous_state = {
            "name": profile_name,
            "profession": profile.profession,
            "memory": profile.memory,
            "understanding_threshold": profile.understanding_threshold,
            "filler_words": filler_count,  # Use the calculated value
            "interest": profile.interest,
            "confidence": profile.confidence,
            "current_emotion": profile.current_emotion
        }

        formatted_prompt = prompt_template.replace("{{frontend_message}}", str(message))
        formatted_prompt = formatted_prompt.replace("{{previous_state_json}}", json.dumps(previous_state, indent=2))

        try:
            print(f"Trying to send to LLM with previous state: {previous_state}")
            response = client.messages.create(
                model="claude-3-7-sonnet-20250219",
                max_tokens=1000,
                messages=[{"role": "user", "content": formatted_prompt}]
            )
            print("LLM response received")

            response_text = response.content[0].text
            print(f"Raw response: {response_text}")

            # Parse the response text into a dictionary
            try:
                state_dict = json.loads(response_text)
                updated_state = ProfileState(
                    profession=state_dict['profession'],
                    memory=state_dict['memory'],
                    understanding_threshold=state_dict['understanding_threshold'],
                    wps=profile.wps,
                    filler_words=filler_count,  # Use calculated value instead of LLM response
                    interest=state_dict['interest'],
                    confidence=state_dict['confidence']
                )
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse LLM response: {e}")
                raise

            print(f"Updated response parsed: {updated_state}")

            profile.profession = updated_state.profession
            profile.memory = updated_state.memory
            profile.understanding_threshold = updated_state.understanding_threshold
            profile.wps = updated_state.wps
            profile.filler_words = updated_state.filler_words
            profile.interest = updated_state.interest
            profile.confidence = updated_state.confidence

            emotion = await get_emotion_from_text(message, previous_state)
            profile.current_emotion = emotion

            print(f"Updated user profile state: {profile}")

        except Exception as e:
            print("Error during LLM processing or profile update!")
            print(f"Error: {e}")

    return {"emotion": emotion}

def parse_data(data):
    profile_name = data.get("profile_name")
    message = data.get("message", "")
    timestamp = data.get("timestamp", 0)
    return profile_name, message, timestamp

@app.post("/process")
async def receive_data(request: Request):
    data = await request.json()
    print("Data received:", data)
    result = await process_data(data)
    return {"status": "success", "emotion": result["emotion"]}

@app.websocket("/ws/transcribe/{participant_identity}")
async def websocket_transcribe(websocket: WebSocket, participant_identity: str):
    await websocket.accept()
    print(f"Client connected for transcription: {websocket.client} (identity: {participant_identity})")

    # Get or create a profile for the connected user
    user_profile = get_or_create_profile(participant_identity)

    transcription_service = create_transcription_service(user_profile)
    if not transcription_service:
        if vosk_model is None:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Speech recognition model is still loading. Please wait a moment and try again."
            }))
        else:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Speech recognition service not available"
            }))
        await websocket.close()
        return

    # Store the active session
    active_sessions[participant_identity] = transcription_service
    print(f"Session created for {participant_identity}")

    # Create a background task to send periodic pings
    async def ping_task():
        while True:
            try:
                await asyncio.sleep(10)  # Send ping every 10 seconds
                if websocket.client_state == websocket.client_state.CONNECTED:
                    print(f"Sending ping to {participant_identity}")
                    await websocket.send_text(json.dumps({"type": "ping"}))
                else:
                    break
            except Exception as e:
                print(f"Ping task error for {participant_identity}: {e}")
                break

    # Start the ping task in the background
    ping_job = asyncio.create_task(ping_task())

    try:
        while True:
            try:
                # Receive text messages (JSON format from frontend)
                message = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                
                try:
                    data = json.loads(message)
                    if "bytes" in data:
                        # Handle audio data from frontend
                        audio_bytes = bytes(data["bytes"])
                        print(f"Received audio data from {participant_identity}: {len(audio_bytes)} bytes")
                        
                        result = await transcription_service.process_audio(audio_bytes, executor)
                        if result:
                            await websocket.send_text(json.dumps(result))
                    elif data.get('type') == 'pong':
                        print(f"Received pong from {participant_identity}")
                    else:
                        print(f"Received unexpected message from {participant_identity}: {data}")
                except json.JSONDecodeError:
                    print(f"Invalid JSON message from {participant_identity}: {message}")
                            
            except asyncio.TimeoutError:
                # Connection has been idle for too long
                print(f"Connection timeout for {participant_identity}, closing connection")
                break

    except WebSocketDisconnect:
        print(f"Client disconnected gracefully: {websocket.client} (identity: {participant_identity})")
    except Exception as e:
        print(f"WebSocket error for {participant_identity}: {e}")
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Connection error: {str(e)}"
            }))
        except:
            pass
    finally:
        # Cancel the ping task
        ping_job.cancel()
        # Clean up the session
        if participant_identity in active_sessions:
            del active_sessions[participant_identity]
        print(f"Client disconnected: {websocket.client} (identity: {participant_identity})")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)
