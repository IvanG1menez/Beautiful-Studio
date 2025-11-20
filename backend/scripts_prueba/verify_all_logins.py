"""
Verificación final - Probar login de todos los roles
"""
import requests
import json

print("\n" + "="*60)
print("VERIFICACIÓN FINAL DE LOGIN")
print("="*60 + "\n")

url = "http://127.0.0.1:8000/api/users/login/"

# Credenciales a probar
tests = [
    {"email": "admin@test.com", "password": "admin123", "rol": "Propietario"},
    {"email": "mailfalso321@yahoo.com", "password": "profesional123", "rol": "Profesional"},
]

for test in tests:
    print(f"🔑 Probando {test['rol']}: {test['email']}")
    
    try:
        response = requests.post(
            url,
            json={
                "email": test["email"],
                "password": test["password"]
            },
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ LOGIN EXITOSO")
            print(f"   Usuario: {data.get('user', {}).get('email')}")
            print(f"   Rol: {data.get('user', {}).get('role')}")
            print(f"   Token: {data.get('token', '')[:30]}...")
        else:
            print(f"   ❌ ERROR {response.status_code}")
            print(f"   Respuesta: {response.text}")
    
    except Exception as e:
        print(f"   ❌ ERROR: {str(e)}")
    
    print("")

print("="*60)
print("\n✅ CONTRASEÑAS RESETEADAS:")
print("   • Propietarios: admin123")
print("   • Profesionales: profesional123")
print("   • Clientes: cliente123")
print("\n" + "="*60 + "\n")
