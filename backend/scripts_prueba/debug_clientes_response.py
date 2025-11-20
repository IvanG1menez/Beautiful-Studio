"""
Script para verificar qué devuelve exactamente el endpoint
"""
import requests
import json

BASE_URL = "http://localhost:8000/api"

# Login como profesional
login_data = {
    "email": "pro.adriana.cruz.pro636292@gmail.com",
    "password": "password123"
}

response = requests.post(f"{BASE_URL}/users/login/", json=login_data)
data = response.json()
token = data.get('token')

headers = {
    'Authorization': f'Token {token}',
    'Content-Type': 'application/json'
}

response = requests.get(f"{BASE_URL}/clientes/mis_clientes/", headers=headers)

print("Status Code:", response.status_code)
print("\nResponse completo:")
print(json.dumps(response.json(), indent=2, ensure_ascii=False))
