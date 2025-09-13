from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import json
import anthropic
import instructor
from pydantic import BaseModel, Field
from typing import Dict
import asyncio
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import other python files
from profiles import Profile
from buddy import Buddy
from livekit_api import setup_livekit_routes
from services import create_transcription_service

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

client = anthropic.Anthropic(api_key="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")

# Setup LiveKit API routes
setup_livekit_routes(app)

# Constants
EXPECTED_PROFILES = 2

# Global variables
profiles = []
buddy = None
prompt_template = None

# On server startup, set up the objects holding the "profiles" of people
@app.on_event("startup")
async def startup_event():
    global profiles, buddy, prompt_template
    print("Backend server is starting up!")

    # Step 1: Load XML prompt template
    try:
        with open("prompts/base.xml", "r") as f:
            prompt_template = f.read()
            print("Loaded prompt template")
    except Exception as e:
        print(f"Error loading prompt template: {e}")
        return

    # Step 2: Initialize empty profiles list and buddy
    profiles = [None] * EXPECTED_PROFILES
    buddy = Buddy()
    print("Buddy initialized")
    
    # Step 3: Initialize transcription service
    transcription_service = create_transcription_service()
    if transcription_service:
        print("Voice recognition system ready")
    else:
        print("Voice recognition system disabled - no model found")

    # Step 4: Wait for profiles to connect (simulate by reading from profile.json)
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
                profiles[i] = new_profile  # Use index instead of append since we initialized with [None] * EXPECTED_PROFILES
                print(f"Profile {i} registered: {new_profile}")

                break  # Exit the while loop once profile is loaded
            except FileNotFoundError:
                print(f"Waiting for profile {i} data...")
                await asyncio.sleep(1)
            except Exception as e:
                print(f"Error loading profile {i}: {e}")
                await asyncio.sleep(1)

    print(f"All {EXPECTED_PROFILES} profiles connected.")

# Process incoming data, update profiles, and have buddy react
def process_data(data):
    global profiles, buddy, prompt_template
    print("Processing data:")
    
    # Parse data into variables
    profile_name, message, timestamp = parse_data(data)
    
    # Process main user's profile
    profile = profiles[0] # Assuming first profile is the main user
    if profile is not None and prompt_template:
        # Calculate WPS if we have previous data
        if profile.last_timestamp is not None and profile.last_message is not None:
            time_diff = timestamp - profile.last_timestamp
            if time_diff > 0:
                words_current = len(message.split())
                words_per_second = words_current / time_diff
                profile.wps = round(words_per_second)
                print(f"Calculated WPS: {profile.wps}")

        # Store current message and timestamp for next calculation
        profile.last_message = message
        profile.last_timestamp = timestamp

        # Get current state for LLM
        previous_state = {
            "name": profile_name,
            "profession": profile.profession,
            "memory": profile.memory,
            "understanding_threshold": profile.understanding_threshold,
            "filler_words": profile.filler_words,
            "interest": profile.interest,
            "confidence": profile.confidence
        }
        
        # Format prompt with dynamic inputs
        formatted_prompt = prompt_template.replace("{{frontend_message}}", str(message))
        formatted_prompt = formatted_prompt.replace("{{previous_state_json}}", json.dumps(previous_state, indent=2))
        
        try:
            # Use direct Anthropic API for now (TODO: Fix instructor integration)
            response = client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=1000,
                messages=[{"role": "user", "content": formatted_prompt}]
            )
            
            # For now, just parse the response text manually (TODO: Use structured output)
            response_text = response.content[0].text
            print(f"Raw response: {response_text}")
            
            # Create a minimal updated state (TODO: Parse structured response)
            updated_state = ProfileState(
                profession=profile.profession,
                memory=profile.memory,
                understanding_threshold=profile.understanding_threshold,
                wps=profile.wps,
                filler_words=profile.filler_words,
                interest=profile.interest,
                confidence=profile.confidence
            )

            # Update profile with new state (keeping our calculated WPS)
            profile.profession = updated_state.profession
            profile.memory = updated_state.memory
            profile.understanding_threshold = updated_state.understanding_threshold
            profile.wps = updated_state.wps 
            profile.filler_words = updated_state.filler_words
            profile.interest = updated_state.interest
            profile.confidence = updated_state.confidence
            
            print(f"Updated user profile state:", profile)
            
        except Exception as e:
            print(f"Error processing user profile: {e}")
    
    return

# Parses incoming data
def parse_data(data):
    profile_name = data.get("profile_name")
    message = data.get("message", "")
    timestamp = data.get("timestamp", 0)
    return profile_name, message, timestamp

# Endpoint to receive data
@app.post("/process")
async def receive_data(request: Request):
    data = await request.json()
    print("Data received:", data)
    process_data(data)
    return {"status": "success"}

# WebSocket endpoint for live transcription
@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    await websocket.accept()
    print(f"Client connected for transcription: {websocket.client}")

    # Create a new transcription service for this connection
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
            # Receive audio data
            data = await websocket.receive_bytes()
            print(f"Received audio data: {len(data)} bytes")

            # Process audio with the service
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
            pass  # Connection might already be closed
    finally:
        print(f"Client disconnected: {websocket.client}")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)
