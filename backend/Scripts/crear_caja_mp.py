#!/usr/bin/env python
"""
Script para registrar una Caja (POS) en Mercado Pago
Esto es necesario ANTES de que funcione el flujo de QR nativo
"""
import os
import sys
import json
import requests
from pathlib import Path

# Añadir el backend al path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from django.conf import settings

def obtener_sucursales_mp(access_token):
    """Obtiene las sucursales existentes en Mercado Pago"""
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    collector_id = getattr(settings, 'MP_QR_COLLECTOR_ID', '')
    print("📤 Obteniendo sucursales existentes...")
    print(f"   Collector ID: {collector_id}")
    print()
    
    try:
        response = requests.get(
            f"https://api.mercadopago.com/users/{collector_id}/stores",
            headers=headers,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            stores = data if isinstance(data, list) else data.get('stores', [])
            
            if stores:
                print("✅ Sucursales encontradas:")
                for store in stores:
                    print(f"  - ID: {store.get('id')}, Nombre: {store.get('name')}")
                print()
                return stores[0].get('id')
            else:
                print("⚠️  No hay sucursales registradas")
                return None
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.text)
            return None
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def crear_caja_mp(access_token, store_id):
    """Registra una caja (POS) en Mercado Pago"""
    
    if not store_id:
        print("\n⚠️  No se encontró sucursal automáticamente.")
        print("   Necesitas proporcionar el store_id manualmente.")
        print("   (Lo encuentras en MP dashboard → Configuración → Tiendas)")
        print()
        store_id = input("📝 Ingresa tu store_id: ").strip()
        if not store_id:
            print("❌ store_id requerido")
            return None

    external_store_id = getattr(settings, 'MP_QR_EXTERNAL_STORE_ID', '')
    external_pos_id = getattr(settings, 'MP_QR_POS_EXTERNAL_ID', '')
    
    print()
    print("📤 Registrando Caja (POS)...")
    
    payload = {
        "name": "Profesional - POS 1",
        "fixed_amount": False,
        "store_id": store_id,
        "external_store_id": external_store_id,
        "external_id": external_pos_id,
        "category": 621102
    }
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    print(f"   Payload: {json.dumps(payload, indent=4)}")
    print()
    
    try:
        response = requests.post(
            "https://api.mercadopago.com/pos",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if response.status_code in [200, 201]:
            data = response.json()
            print("✅ ¡Caja (POS) creada exitosamente!")
            print(f"\nDatos de la Caja:")
            print(f"  ID: {data.get('id')}")
            print(f"  Nombre: {data.get('name')}")
            print(f"  Estado: {data.get('status')}")
            print(f"  user_id: {data.get('user_id')}")
            print(f"  external_store_id: {data.get('external_store_id')}")
            print(f"  external_id: {data.get('external_id')}")
            
            pos_id = data.get('id')
            if pos_id:
                print(f"\n⚠️  ACTUALIZA TU .env:")
                print(f"   MP_QR_POS_EXTERNAL_ID={data.get('external_id') or pos_id}")
            return data
        else:
            print(f"❌ Error {response.status_code}:")
            print(response.text)
            return None
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

if __name__ == '__main__':
    access_token = getattr(settings, 'MP_QR_ACCESS_TOKEN', '')
    if not access_token:
        print("❌ Error: MP_QR_ACCESS_TOKEN no configurado")
        sys.exit(1)
    
    print("=" * 60)
    print("REGISTRO DE CAJA (POS) EN MERCADO PAGO")
    print("=" * 60)
    print()
    
    # Si se proporciona store_id como argumento, úsalo; si no, toma el del .env
    store_id = sys.argv[1] if len(sys.argv) > 1 else getattr(settings, 'MP_QR_STORE_ID', '')
    
    if not store_id:
        store_id = obtener_sucursales_mp(access_token)
    
    crear_caja_mp(access_token, store_id)
