from fastapi import FastAPI, Request, WebSocket
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

# Load environment variables from .env file
load_dotenv()

# Import other python files
from profiles import Profile
from buddy import Buddy
from livekit_api import setup_livekit_routes


FILLER_WORDS = {"um", "uh", "like", "so", "you know", "actually", "basically", "literally", "well", "right"}

# Pydantic model for structured output
class ProfileState(BaseModel):
    profession: str = Field(..., description="Professional role/background")
    memory: Dict[str, str] = Field(..., description="Updated knowledge, assumptions, or insights")
    understanding_threshold: float = Field(..., ge=0, le=1, description="Minimum comprehension needed to stay engaged")
    wps: int = Field(..., ge=0, le=10, description="Words per second when speaking")
    filler_words: int = Field(..., ge=0, le=50, description="Number of filler words per minute when speaking")
    interest: float = Field(..., ge=0, le=1, description="Current interest level in the topic")
    confidence: float = Field(..., ge=0, le=1, description="Confidence in understanding of current discussion")

app = FastAPI()

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Frontend dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# Setup LiveKit API routes
setup_livekit_routes(app)

# Constants
EXPECTED_PROFILES = 2
VOSK_MODEL_PATH = "vosk-model"
VOSK_SAMPLE_RATE = 16000
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"

# Global variables
profiles = []
buddy = None
prompt_template = None

# LOGGING
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load Vosk model
vosk_model = None
try:
    if os.path.exists(VOSK_MODEL_PATH):
        vosk_model = Model(VOSK_MODEL_PATH)
        logger.info("Vosk model loaded successfully")
    else:
        logger.warning(f"Vosk model not found at {VOSK_MODEL_PATH}")
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
        "Respond with ONLY ONE word only from: idle, question, nodding, shaking_head, excited, thinking, confused, speaking, slow. Make sure there is ABSOLUTELY NO punctuation, extra words, newlines, etc.\n\n"
    )

    payload = {
        "model": "claude-3-5-haiku-20241022",
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
def create_transcription_service():
    from services import TranscriptionService
    try:
        return TranscriptionService()
    except ValueError as e:
        logger.error(f"Cannot create transcription service: {e}")
        return None

# On server startup
@app.on_event("startup")
async def startup_event():
    global profiles, buddy, prompt_template
    print("Backend server is starting up!")

    try:
        with open("prompts/base.xml", "r") as f:
            prompt_template = f.read()
            print("Loaded prompt template")
    except Exception as e:
        print(f"Error loading prompt template: {e}")
        return

    profiles = [None] * EXPECTED_PROFILES
    buddy = Buddy()
    print("Buddy initialized")
    
    transcription_service = create_transcription_service()
    if transcription_service:
        print("Voice recognition system ready")
    else:
        print("Voice recognition system disabled - no model found")

    print(f"Waiting for {EXPECTED_PROFILES} profiles to connect...")
    for i in range(EXPECTED_PROFILES):
        while True:
            try:
                with open(f"profile{i}.json", "r") as f:
                    data = json.load(f)
                new_profile = Profile(
                    name=data.get("name", f"User{len(profiles)}"),
                    profession=data.get("profession", "Unknown"),
                    memory=data.get("memory", {}),
                    understanding_threshold=data.get("understanding_threshold", 0.5)
                )
                profiles[i] = new_profile
                print(f"Profile {i} registered: {new_profile}")
                break
            except FileNotFoundError:
                print(f"Waiting for profile {i} data...")
                await asyncio.sleep(1)
            except Exception as e:
                print(f"Error loading profile {i}: {e}")
                await asyncio.sleep(1)

    print(f"All {EXPECTED_PROFILES} profiles connected.")

# Process data
async def process_data(data):
    global profiles, buddy, prompt_template
    print("Processing data:")

    profile_name, message, timestamp = parse_data(data)
    profile = profiles[0]  # Assuming first profile is the main user
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

@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    await websocket.accept()
    print(f"Client connected for transcription: {websocket.client}")

    transcription_service = create_transcription_service()
    if not transcription_service:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "Speech recognition service not available"
        }))
        await websocket.close()
        return

    try:
        while True:
            data = await websocket.receive_bytes()
            print(f"Received audio data: {len(data)} bytes")

            result = await transcription_service.process_audio(data)
            if result:
                await websocket.send_text(json.dumps(result))

    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Connection error: {str(e)}"
            }))
        except:
            pass
    finally:
        print(f"Client disconnected: {websocket.client}")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)
