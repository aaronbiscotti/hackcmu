from fastapi import FastAPI, Request
import uvicorn
import json
import anthropic
import instructor
from pydantic import BaseModel, Field
from typing import Dict

# Import other python files
import Profiles
import Buddy

# Pydantic model for structured output
class ProfileState(BaseModel):
    profession: str = Field(..., description="Professional role/background")
    memory: Dict[str, str] = Field(..., description="Updated knowledge, assumptions, or insights")
    understanding_threshold: float = Field(..., ge=0, le=1, description="Minimum comprehension needed to stay engaged")
    wps: int = Field(..., ge=1, le=10, description="Words per second speaking rate")
    filler_words: int = Field(..., ge=0, le=50, description="Number of filler words per minute when speaking")
    interest: float = Field(..., ge=0, le=1, description="Current interest level in the topic")
    confidence: float = Field(..., ge=0, le=1, description="Confidence in understanding of current discussion")

# API declarations
app = FastAPI()
llm = instructor.from_anthropic(anthropic.Anthropic(api_key="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"))

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
    json_file_path = "profiles.json"  # Change this path!!!

    # Load XML prompt template
    try:
        with open("prompts/base.xml", "r") as f:
            prompt_template = f.read()
            print("Loaded prompt template")
    except Exception as e:
        print(f"Error loading prompt template: {e}")

    # Open profiles path
    try:
        with open(json_file_path, "r") as f:
            global profiles_data
            profiles_data = json.load(f)
            print("Loaded profiles:", profiles_data)
    except Exception as e:
        print(f"Error loading profiles: {e}")
        profiles_data = {}
    
    # Initialize profiles list
    profiles = [None] * EXPECTED_PROFILES
    
    # Initialize profiles
    for i in range(EXPECTED_PROFILES):
        profiles[i] = Profiles.Profile(
            name=f"Profile_{i}",
            prof="Business Manager", 
            mem={"meeting_context": "technical discussion starting"}
        )
        profiles[i].load_from_json(profiles_data.get(str(i), {}))
        print(f"Initialized profile {i}: {profiles[i]}")
    
    # Initialize buddy
    buddy = Buddy.Buddy()
    print("Buddy initialized.")

# Process incoming data, update profiles, and have buddy react
def process_data(data):
    global profiles, buddy, prompt_template
    print("Processing data:")
    
    # Parse data into variables
    profile_name, phrase_with_timestamp = parse_data(data)
    
    # Process each profile
    for i, profile in enumerate(profiles):
        if profile is not None and prompt_template:
            # Get current state
            previous_state = {
                "profession": profile.prof,
                "memory": profile.mem,
                "understanding_threshold": profile.understand_threshold,
                "wps": 3,
                "filler_words": 8,
                "interest": 0.5,
                "confidence": 0.5
            }
            
            # Format prompt with dynamic inputs
            formatted_prompt = prompt_template.replace("{{frontend_message}}", str(phrase_with_timestamp))
            formatted_prompt = formatted_prompt.replace("{{previous_state_json}}", json.dumps(previous_state, indent=2))
            
            try:
                # Use instructor for structured response
                updated_state = llm.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=1000,
                    messages=[{"role": "user", "content": formatted_prompt}],
                    response_model=ProfileState
                )
                
                # Update profile with new state
                profile.prof = updated_state.profession
                profile.mem = updated_state.memory
                profile.understand_threshold = updated_state.understanding_threshold
                
                print(f"Updated profile {i} state:", updated_state.model_dump())
                
            except Exception as e:
                print(f"Error processing profile {i}: {e}")
    
    return {"status": "processed"}

# Parses incoming data
def parse_data(data):
    # TODO: Parse data please
    profile_name = None
    phrase_with_timestamp = None
    return profile_name, phrase_with_timestamp

# Endpoint to receive data
@app.post("/process")
async def receive_data(request: Request):
    data = await request.json()
    process_data(data)
    return {"status": "success"}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
