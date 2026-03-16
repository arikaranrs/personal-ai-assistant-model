import requests

url = "http://127.0.0.1:5000/api/chat"
data = {
    "userId": "test_script_user",
    "prompt": "What are the legal implications of a contract breach in India?"
}

try:
    response = requests.post(url, json=data, stream=True)
    for line in response.iter_lines():
        if line:
            print(line.decode('utf-8'))
except Exception as e:
    print(f"Error testing API: {e}")
