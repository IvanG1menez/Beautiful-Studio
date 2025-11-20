"""
Script para probar los endpoints de completar turnos masivamente.
Asegúrate de tener un usuario profesional autenticado.
"""

import requests
import json
from datetime import datetime, timedelta

# Configuración
BASE_URL = "http://127.0.0.1:8000/api"
TOKEN = ""  # Actualiza con tu token de profesional

# Headers
headers = {
    "Authorization": f"Token {TOKEN}",
    "Content-Type": "application/json"
}


def test_pendientes_rango():
    """Test 1: Obtener turnos pendientes en un rango de fechas"""
    print("\n" + "="*60)
    print("TEST 1: Buscar Turnos Pendientes en Rango")
    print("="*60)
    
    fecha_desde = "2025-01-01"
    fecha_hasta = "2025-12-31"
    
    url = f"{BASE_URL}/turnos/pendientes-rango/"
    params = {
        "fecha_desde": fecha_desde,
        "fecha_hasta": fecha_hasta
    }
    
    print(f"\n📡 GET {url}")
    print(f"📅 Parámetros: {params}")
    
    response = requests.get(url, headers=headers, params=params)
    
    print(f"\n✅ Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Total turnos: {data.get('total', 0)}")
        print(f"📅 Rango: {data.get('fecha_desde')} - {data.get('fecha_hasta')}")
        
        if data.get('turnos'):
            print(f"\n📋 Primeros 3 turnos:")
            for turno in data['turnos'][:3]:
                print(f"  - ID: {turno['id']} | Cliente: {turno['cliente_nombre']} | Servicio: {turno['servicio_nombre']} | Estado: {turno['estado']}")
        
        return data.get('turnos', [])
    else:
        print(f"❌ Error: {response.text}")
        return []


def test_completar_masivo_por_ids(turno_ids):
    """Test 2: Completar turnos por IDs específicos"""
    print("\n" + "="*60)
    print("TEST 2: Completar Turnos por IDs Específicos")
    print("="*60)
    
    if not turno_ids:
        print("⚠️ No hay turnos para completar")
        return
    
    # Tomar solo los primeros 3 turnos para prueba
    turno_ids_test = turno_ids[:3]
    
    url = f"{BASE_URL}/turnos/completar-masivo/"
    payload = {
        "turno_ids": turno_ids_test
    }
    
    print(f"\n📡 POST {url}")
    print(f"📦 Body: {json.dumps(payload, indent=2)}")
    
    response = requests.post(url, headers=headers, json=payload)
    
    print(f"\n✅ Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Completados: {data.get('completados')}/{data.get('total_seleccionados')}")
        
        if data.get('errores'):
            print(f"\n⚠️ Errores encontrados: {len(data['errores'])}")
            for error in data['errores']:
                print(f"  - Turno {error['turno_id']}: {error['error']}")
    else:
        print(f"❌ Error: {response.text}")


def test_completar_masivo_por_rango():
    """Test 3: Completar turnos por rango de fechas"""
    print("\n" + "="*60)
    print("TEST 3: Completar Turnos por Rango de Fechas")
    print("="*60)
    
    # Últimos 30 días
    fecha_hasta = datetime.now()
    fecha_desde = fecha_hasta - timedelta(days=30)
    
    url = f"{BASE_URL}/turnos/completar-masivo/"
    payload = {
        "fecha_desde": fecha_desde.isoformat(),
        "fecha_hasta": fecha_hasta.isoformat()
    }
    
    print(f"\n📡 POST {url}")
    print(f"📦 Body: {json.dumps(payload, indent=2)}")
    
    response = requests.post(url, headers=headers, json=payload)
    
    print(f"\n✅ Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Completados: {data.get('completados')}/{data.get('total_seleccionados')}")
        
        if data.get('errores'):
            print(f"\n⚠️ Errores encontrados: {len(data['errores'])}")
            for error in data['errores'][:5]:  # Mostrar solo primeros 5
                print(f"  - Turno {error['turno_id']}: {error['error']}")
    else:
        print(f"❌ Error: {response.text}")


def test_completar_ultima_semana():
    """Test 4: Completar turnos de la última semana"""
    print("\n" + "="*60)
    print("TEST 4: Completar Turnos de Última Semana")
    print("="*60)
    
    url = f"{BASE_URL}/turnos/completar-ultima-semana/"
    
    print(f"\n📡 POST {url}")
    print("📦 Body: vacío")
    
    response = requests.post(url, headers=headers)
    
    print(f"\n✅ Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Completados: {data.get('completados')}/{data.get('total_encontrados')}")
        print(f"📅 Rango procesado: {data.get('fecha_desde')} - {data.get('fecha_hasta')}")
        
        if data.get('errores'):
            print(f"\n⚠️ Errores encontrados: {len(data['errores'])}")
            for error in data['errores'][:5]:
                print(f"  - Turno {error['turno_id']}: {error['error']}")
    else:
        print(f"❌ Error: {response.text}")


def test_permisos_sin_token():
    """Test 5: Verificar que requiere autenticación"""
    print("\n" + "="*60)
    print("TEST 5: Verificar Autenticación Requerida")
    print("="*60)
    
    url = f"{BASE_URL}/turnos/pendientes-rango/"
    
    print(f"\n📡 GET {url} (sin token)")
    
    response = requests.get(url)
    
    print(f"\n✅ Status Code: {response.status_code}")
    
    if response.status_code == 401:
        print("✅ Correctamente requiere autenticación")
    else:
        print(f"⚠️ Respuesta inesperada: {response.text}")


def main():
    """Ejecutar todos los tests"""
    print("\n" + "="*60)
    print("🧪 PRUEBAS DE ENDPOINTS - COMPLETAR TURNOS MASIVO")
    print("="*60)
    
    if not TOKEN:
        print("\n❌ ERROR: Debes configurar el TOKEN de un profesional")
        print("Para obtener el token:")
        print("  1. Ve a /admin/authtoken/tokenproxy/")
        print("  2. Busca el token del usuario profesional")
        print("  3. Copia el token en este script")
        return
    
    # Test 1: Buscar turnos pendientes
    turnos = test_pendientes_rango()
    turno_ids = [t['id'] for t in turnos if t.get('estado') in ['pendiente', 'confirmado']]
    
    # Test 2: Completar por IDs
    if turno_ids:
        test_completar_masivo_por_ids(turno_ids)
    
    # Test 3: Completar por rango (comentado para no afectar datos reales)
    # test_completar_masivo_por_rango()
    
    # Test 4: Completar última semana (comentado para no afectar datos reales)
    # test_completar_ultima_semana()
    
    # Test 5: Verificar permisos
    test_permisos_sin_token()
    
    print("\n" + "="*60)
    print("✅ PRUEBAS COMPLETADAS")
    print("="*60)


if __name__ == "__main__":
    main()
