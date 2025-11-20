"""
Script para verificar qué devuelve el endpoint /api/users/profile/
"""
import requests

BASE_URL = "http://localhost:8000/api"

print("=" * 60)
print("TEST: Endpoint /users/profile/")
print("=" * 60)

# Login con Ricardo Prieto
login_data = {
    "email": "ricardo.prieto98@hotmail.com",
    "password": "password123"
}

try:
    # Login
    response = requests.post(f"{BASE_URL}/users/login/", json=login_data)
    
    if response.status_code == 200:
        data = response.json()
        token = data.get('token')
        print(f"✓ Login exitoso")
        
        # Obtener perfil
        headers = {
            'Authorization': f'Token {token}',
            'Content-Type': 'application/json'
        }
        
        response = requests.get(f"{BASE_URL}/users/profile/", headers=headers)
        
        if response.status_code == 200:
            profile_data = response.json()
            print(f"\n✓ Perfil obtenido exitosamente")
            print(f"\nEstructura del response:")
            print(f"Keys disponibles: {list(profile_data.keys())}")
            
            print(f"\n--- DATOS COMPLETOS ---")
            import json
            print(json.dumps(profile_data, indent=2, ensure_ascii=False))
            
            # Verificar cliente_profile
            if 'cliente_profile' in profile_data:
                print(f"\n✓ Tiene 'cliente_profile'")
                cliente = profile_data['cliente_profile']
                if cliente:
                    print(f"  - ID: {cliente.get('id')}")
                    print(f"  - Nombre: {cliente.get('nombre_completo')}")
                    print(f"  - Teléfono: {cliente.get('telefono')}")
                    print(f"  - Email (user): {cliente.get('user', {}).get('email')}")
                else:
                    print(f"  ✗ cliente_profile es null")
            else:
                print(f"\n✗ NO tiene 'cliente_profile'")
                
        else:
            print(f"✗ Error al obtener perfil: {response.status_code}")
            print(response.text)
    else:
        print(f"✗ Error en login: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"✗ Error: {e}")

print("\n" + "=" * 60)
