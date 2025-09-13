import requests
import json

def test_process_endpoint():
    url = "http://127.0.0.1:8000/process"
    test_data = {
        "profile_name": "TestUser",
        "message": "Hello, this is a test message",
        "timestamp": 1632512400
    }
    
    try:
        response = requests.post(url, json=test_data)
        print(f"Status Code: {response.status_code}")
        print(f"Response Text: {response.text}")
        
        if response.status_code == 200:
            try:
                print(f"JSON Response: {response.json()}")
            except requests.exceptions.JSONDecodeError as e:
                print(f"Could not decode JSON response: {e}")
        else:
            print(f"Server returned error status code: {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("Could not connect to server. Make sure the FastAPI server is running.")

if __name__ == "__main__":
    test_process_endpoint()