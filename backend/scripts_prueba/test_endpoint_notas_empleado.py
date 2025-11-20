"""
Script para verificar que el endpoint /mis_turnos/ devuelve las notas del empleado
"""
import requests
import json

BASE_URL = "http://localhost:8000/api"

# Necesitamos un token de autenticación
# Intentaremos con las credenciales del turno cancelado (ID 98)

print("=" * 60)
print("TEST: Endpoint /mis_turnos/ - Notas del Empleado")
print("=" * 60)

# Primero, intentar login con un cliente
print("\n1. Intentando login como cliente...")

login_data = {
    "email": "ricardo.prieto98@hotmail.com",  # Cliente del turno 98 cancelado
    "password": "password123"
}

try:
    response = requests.post(f"{BASE_URL}/users/login/", json=login_data)
    
    if response.status_code == 200:
        data = response.json()
        token = data.get('token')
        print(f"✓ Login exitoso - Token obtenido")
        
        # Obtener mis turnos
        print("\n2. Obteniendo turnos del cliente...")
        headers = {
            'Authorization': f'Token {token}',
            'Content-Type': 'application/json'
        }
        
        response = requests.get(f"{BASE_URL}/turnos/mis_turnos/?page_size=100", headers=headers)
        
        if response.status_code == 200:
            turnos_data = response.json()
            turnos = turnos_data.get('results', turnos_data) if isinstance(turnos_data, dict) else turnos_data
            
            print(f"✓ Turnos obtenidos: {len(turnos)}")
            
            # Buscar turnos cancelados
            turnos_cancelados = [t for t in turnos if t.get('estado') == 'cancelado']
            
            print(f"\n3. Turnos cancelados: {len(turnos_cancelados)}")
            
            if turnos_cancelados:
                print("\n" + "=" * 60)
                print("TURNOS CANCELADOS CON NOTAS:")
                print("=" * 60)
                
                for turno in turnos_cancelados:
                    print(f"\nID: {turno.get('id')}")
                    print(f"Servicio: {turno.get('servicio_nombre')}")
                    print(f"Estado: {turno.get('estado_display')}")
                    print(f"Fecha: {turno.get('fecha_hora')}")
                    print(f"Notas del cliente: [{turno.get('notas_cliente') or 'Sin notas'}]")
                    
                    # VERIFICAR SI TIENE NOTAS DEL EMPLEADO
                    notas_empleado = turno.get('notas_empleado')
                    if notas_empleado:
                        print(f"✓ Notas del empleado: [{notas_empleado}]")
                    else:
                        print("✗ NO TIENE notas_empleado en la respuesta")
                    
                    print("-" * 60)
            else:
                print("\n✗ No se encontraron turnos cancelados para este cliente")
                print("\nTurnos disponibles:")
                for t in turnos[:5]:
                    print(f"  - ID {t.get('id')}: {t.get('servicio_nombre')} - Estado: {t.get('estado')}")
        else:
            print(f"✗ Error al obtener turnos: {response.status_code}")
            print(response.text)
    else:
        print(f"✗ Error en login: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"✗ Error: {e}")

print("\n" + "=" * 60)
print("TEST COMPLETADO")
print("=" * 60)
