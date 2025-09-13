import asyncio
import time
import json
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

from main import startup_event, process_data, profiles, Profile

async def run_test():
    # Ensure at least one profile exists
    global profiles

    await startup_event()

    # Fake data packet (like transcription would generate)
    timestamp = time.time()
    test_data_list = []
    test_data = {
        "profile_name": "TestUser",
        "message": "I think this project is really exciting!",
        "timestamp": timestamp,
        "metrics": {
            "wpm": 120,
            "filler_words": 2,
            "clarity_score": 95,
            "word_count": 7
        }
    }
    test_data_list.append(test_data)
    test_data = {
        "profile_name": "TestUser",
        "message": "However, I'm a bit concerned about the timeline.",
        "timestamp": timestamp + 8,
        "metrics": {
            "wpm": 100,
            "filler_words": 5,
            "clarity_score": 90,
            "word_count": 9
        }
    }
    test_data_list.append(test_data)
    test_data = {
        "profile_name": "TestUser",
        "message": "Um uh like uh so literally uh",
        "timestamp": timestamp + 9,
        "metrics": {
            "wpm": 110,
            "filler_words": 3,
            "clarity_score": 92,
            "word_count": 8
        }
    }
    test_data_list.append(test_data)
    test_data = {
        "profile_name": "TestUser",
        "message": "We had to blue top the new site with a spring box and a buried deadman, but after a feasibility study, we found a Siamese connection could bypass the need for a jack and bore.",
        "timestamp": timestamp + 19,
        "metrics": {
            "wpm": 110,
            "filler_words": 3,
            "clarity_score": 92,
            "word_count": 8
        }
    }
    test_data_list.append(test_data)
    test_data = {
        "profile_name": "TestUser",
        "message": "I got a lot of words I got a lot of words this should result in a slow down reaction",
        "timestamp": timestamp + 20,
        "metrics": {
            "wpm": 110,
            "filler_words": 3,
            "clarity_score": 92,
            "word_count": 8
        }
    }
    test_data_list.append(test_data)

    for test_data in test_data_list:
        print(":::::::::::::::::::::::::::::::::TESTCASE STARTED:::::::::::::::::::::::::::::::::")
        print("\n--- Sending test data into process_data ---")
        print(json.dumps(test_data, indent=2))

        result = await process_data(test_data)

        print("\n--- Result from process_data ---")
        print(json.dumps(result, indent=2))

if __name__ == "__main__":
    try:
        asyncio.run(run_test())
    except Exception as e:
        logging.error(f"Test failed: {e}")
        raise
