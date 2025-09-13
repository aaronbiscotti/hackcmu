import requests
import json

def test_process_endpoint():
    url = "http://127.0.0.1:8000/process"
    test_data_list = []
    
    test_data = {
        "profile_name": "TestUser",
        "message": "Hello, this is a test message",
        "timestamp": 2
    }
    test_data_list.append(test_data)

    test_data = {
        "profile_name": "TestUser",
        "message": "Um like um like I think like yeah um uh",
        "timestamp": 12
    }
    test_data_list.append(test_data)

    test_data = {
        "profile_name": "TestUser",
        "message": "Let's use the API to query the LLM, it will allow our PCB to use the embeedded cores with multiple threads",
        "timestamp": 13
    }
    test_data_list.append(test_data)

    for test_data in test_data_list:
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