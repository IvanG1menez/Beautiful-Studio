"""
Script para probar el endpoint /api/clientes/mis_clientes/
"""
import requests
import json

BASE_URL = "http://localhost:8000/api"

print("=" * 60)
print("TEST: Endpoint /clientes/mis_clientes/")
print("=" * 60)

# Login como profesional (Adriana Cruz - empleado ID 71)
# Necesitamos encontrar su email primero
import sqlite3

conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()

# Obtener email del profesional ID 71
cursor.execute('''
    SELECT u.email, u.first_name, u.last_name
    FROM empleados_empleado e
    JOIN users_user u ON e.user_id = u.id
    WHERE e.id = 71
''')

result = cursor.fetchone()
conn.close()

if not result:
    print("No se encontró el profesional ID 71")
    exit()

email, nombre, apellido = result
print(f"\n1. Profesional: {nombre} {apellido}")
print(f"   Email: {email}")

# Login
login_data = {
    "email": email,
    "password": "password123"
}

try:
    response = requests.post(f"{BASE_URL}/users/login/", json=login_data)
    
    if response.status_code == 200:
        data = response.json()
        token = data.get('token')
        print(f"✓ Login exitoso")
        
        # Obtener mis clientes
        headers = {
            'Authorization': f'Token {token}',
            'Content-Type': 'application/json'
        }
        
        response = requests.get(f"{BASE_URL}/clientes/mis_clientes/?page_size=100", headers=headers)
        
        if response.status_code == 200:
            clientes_data = response.json()
            clientes = clientes_data.get('results', clientes_data) if isinstance(clientes_data, dict) else clientes_data
            
            print(f"\n✓ Clientes obtenidos: {len(clientes)}")
            
            if clientes:
                print(f"\n=== CLIENTES DEL PROFESIONAL ===\n")
                
                for cliente in clientes[:10]:  # Mostrar primeros 10
                    print(f"Cliente: {cliente.get('nombre_completo')}")
                    print(f"  - Email: {cliente.get('email')}")
                    print(f"  - VIP: {'Sí' if cliente.get('is_vip') else 'No'}")
                    print(f"  - Total turnos: {cliente.get('total_turnos', 0)}")
                    print(f"  - Turnos completados: {cliente.get('turnos_completados', 0)}")
                    print(f"  - Último turno: {cliente.get('ultimo_turno', 'N/A')}")
                    if cliente.get('preferencias'):
                        print(f"  - Preferencias: {cliente.get('preferencias')}")
                    print()
                
                # Estadísticas
                total_clientes = len(clientes)
                clientes_vip = len([c for c in clientes if c.get('is_vip')])
                clientes_frecuentes = len([c for c in clientes if c.get('total_turnos', 0) >= 5])
                
                print(f"\n=== ESTADÍSTICAS ===")
                print(f"Total clientes: {total_clientes}")
                print(f"Clientes VIP: {clientes_vip}")
                print(f"Clientes frecuentes (5+ turnos): {clientes_frecuentes}")
            else:
                print("\nNo tiene clientes aún")
                
        else:
            print(f"✗ Error al obtener clientes: {response.status_code}")
            print(response.text)
    else:
        print(f"✗ Error en login: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
