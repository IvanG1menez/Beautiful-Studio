"""
Prueba del endpoint de disponibilidad usando requests
"""

import requests
import json

# URL del backend
BASE_URL = "http://localhost:8000"

print("=" * 80)
print("PRUEBA REAL DEL ENDPOINT DE DISPONIBILIDAD")
print("=" * 80)

# Datos de prueba (Alberto Sánchez trabaja lunes 14:00-22:00)
empleado_id = 39
servicio_id = 22  # Afeitado Tradicional (30 min)
fecha = "2025-10-27"  # Lunes

url = f"{BASE_URL}/api/turnos/disponibilidad/"
params = {"empleado": empleado_id, "servicio": servicio_id, "fecha": fecha}

print(f"\n📡 Haciendo petición a: {url}")
print(f"   Parámetros: {params}")

try:
    # Nota: Sin autenticación para probar
    response = requests.get(url, params=params)

    print(f"\n📊 Respuesta del servidor:")
    print(f"   Status Code: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"\n✅ ÉXITO - Datos recibidos:")
        print(f"   Disponible: {data.get('disponible')}")
        print(f"   Empleado: {data.get('empleado')}")
        print(f"   Servicio: {data.get('servicio')}")
        print(f"   Fecha: {data.get('fecha')}")

        horarios = data.get("horarios", [])
        print(f"\n   Horarios disponibles: {len(horarios)}")
        if horarios:
            print(f"   Primeros horarios: {', '.join(horarios[:10])}")
            if len(horarios) > 10:
                print(f"   ... y {len(horarios) - 10} más")
    elif response.status_code == 401:
        print(f"\n⚠️  Se requiere autenticación (esperado)")
        print(f"   El endpoint está protegido correctamente")
    else:
        print(f"\n❌ Error: {response.status_code}")
        try:
            error_data = response.json()
            print(f"   Detalles: {json.dumps(error_data, indent=2)}")
        except:
            print(f"   Respuesta: {response.text[:200]}")

except requests.exceptions.ConnectionError:
    print("\n❌ Error de conexión")
    print("   ⚠️  El servidor Django no está corriendo en http://localhost:8000")
except Exception as e:
    print(f"\n❌ Error inesperado: {e}")

print("\n" + "=" * 80)

# Probar otros casos
print("\n📋 PROBANDO OTROS ESCENARIOS:")

# Caso 1: Ana Herrera el sábado
print("\n1️⃣ Ana Herrera (ID: 9) - Sábado 25/10/2025")
params2 = {"empleado": 9, "servicio": 22, "fecha": "2025-10-25"}
try:
    response2 = requests.get(url, params=params2)
    print(f"   Status: {response2.status_code}")
    if response2.status_code == 200:
        data2 = response2.json()
        print(f"   Horarios disponibles: {len(data2.get('horarios', []))}")
    elif response2.status_code == 401:
        print(f"   ⚠️  Requiere autenticación (OK)")
except Exception as e:
    print(f"   Error: {e}")

# Caso 2: Día que no trabaja
print("\n2️⃣ Ana Herrera (ID: 9) - Miércoles 29/10/2025 (no trabaja)")
params3 = {"empleado": 9, "servicio": 22, "fecha": "2025-10-29"}
try:
    response3 = requests.get(url, params=params3)
    print(f"   Status: {response3.status_code}")
    if response3.status_code == 200:
        data3 = response3.json()
        print(f"   Disponible: {data3.get('disponible')}")
        print(f"   Mensaje: {data3.get('mensaje')}")
    elif response3.status_code == 401:
        print(f"   ⚠️  Requiere autenticación (OK)")
except Exception as e:
    print(f"   Error: {e}")

print("\n" + "=" * 80)
