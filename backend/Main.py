from fastapi import FastAPI, Request
import uvicorn
import json
import anthropic

# Import other pyton files
import Profiles
import Buddy

# API declarations
app = FastAPI()
llm = anthropic.Anthropic(api_key="your_api_key_here")

# Constants
EXPECTED_PROFILES = 2

# Global variables
profiles = []
buddy = None

# On server startup, set up the objects holding the "profiles" of people
@app.on_event("startup")
async def startup_event():
    global profiles, buddy
    print("Backend server is starting up!")
    json_file_path = "profiles.json"  # Change this path!!!

    # Open profiles path
    try:
        with open(json_file_path, "r") as f:
            global profiles_data
            profiles_data = json.load(f)
            print("Loaded profiles:", profiles_data)
    except Exception as e:
        print(f"Error loading profiles: {e}")
    
    # Initialize profiles
    for i in range(EXPECTED_PROFILES):
        profiles[i] = Profiles.Profile(i)
        profiles[i].load_from_json(profiles_data.get(str(i), {}))
        print(f"Initialized profile {i}: {profiles[i]}")
    
    # Initialize buddy
    buddy = Buddy.Buddy()
    print("Buddy initialized.")

# Process incoming data, update profiles, and have buddy react
def process_data(data):
    global profiles, buddy
    print("Processing data:")
    
    # Parse data into variables
    profile_name, phrase_with_timestamp = parse_data(data)

    # It's time to query vro
    response = llm.messages.create(
        model="claude-3-5-haiku-20241022",  # Or another Claude model
        max_tokens=100,
        messages=[ {"role": "user", "content":
            "Your prompt here"} # TODO: Fill in prompt
        ]
    )

    # 

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
