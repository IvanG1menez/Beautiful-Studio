"""
Probar login con las credenciales nuevas
"""
import requests
import json

print("\n" + "="*60)
print("PROBANDO LOGIN CON NUEVAS CREDENCIALES")
print("="*60 + "\n")

url = "http://127.0.0.1:8000/api/users/login/"

# Probar con admin
print("🔑 Probando login con admin@test.com...")
response = requests.post(
    url,
    json={
        "email": "admin@test.com",
        "password": "admin123"
    }
)

print(f"Status Code: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    print(f"\n✅✅✅ LOGIN EXITOSO ✅✅✅\n")
    print(f"Token: {data.get('token', '')[:50]}...")
    print(f"Usuario: {data.get('user', {}).get('email')}")
    print(f"Rol: {data.get('user', {}).get('role')}")
    print(f"Nombre: {data.get('user', {}).get('first_name')} {data.get('user', {}).get('last_name')}")
    print("\n🎉 El problema está RESUELTO! Puedes iniciar sesión normalmente.\n")
else:
    print(f"\n❌ ERROR: {response.status_code}")
    print(f"Respuesta: {response.text}\n")

print("="*60 + "\n")
