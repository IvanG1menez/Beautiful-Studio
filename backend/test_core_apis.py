#!/usr/bin/env python
"""
Script de prueba para las APIs de la app core
Ejecutar desde el directorio backend: python test_core_apis.py
"""

import os
import sys
import django
import requests
import json

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'beautiful_studio_backend.settings')
django.setup()

BASE_URL = 'http://127.0.0.1:8000/api/core'

def test_health_check():
    """Probar el endpoint de health check"""
    print("🔍 Probando Health Check...")
    try:
        response = requests.get(f'{BASE_URL}/health/')
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health Check OK: {data['status']}")
            return True
        else:
            print(f"❌ Health Check falló: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ No se pudo conectar al servidor. ¿Está ejecutándose?")
        return False

def test_register():
    """Probar el endpoint de registro"""
    print("\n🔍 Probando Registro de Usuario...")
    
    user_data = {
        'username': 'test_user_core',
        'email': 'test_core@example.com',
        'first_name': 'Usuario',
        'last_name': 'Prueba',
        'phone': '123456789',
        'password': 'password123',
        'password_confirm': 'password123'
    }
    
    try:
        response = requests.post(f'{BASE_URL}/auth/register/', json=user_data)
        if response.status_code == 201:
            data = response.json()
            print(f"✅ Usuario registrado: {data['user']['username']}")
            print(f"🔑 Token: {data['token'][:20]}...")
            return data['token']
        else:
            print(f"❌ Registro falló: {response.status_code}")
            print(response.json())
            return None
    except Exception as e:
        print(f"❌ Error en registro: {e}")
        return None

def test_login():
    """Probar el endpoint de login"""
    print("\n🔍 Probando Login...")
    
    login_data = {
        'email': 'test_core@example.com',
        'password': 'password123'
    }
    
    try:
        response = requests.post(f'{BASE_URL}/auth/login/', json=login_data)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Login exitoso: {data['user']['username']}")
            print(f"👤 Rol: {data['role']}")
            return data['token']
        else:
            print(f"❌ Login falló: {response.status_code}")
            print(response.json())
            return None
    except Exception as e:
        print(f"❌ Error en login: {e}")
        return None

def test_authenticated_endpoints(token):
    """Probar endpoints que requieren autenticación"""
    print("\n🔍 Probando endpoints autenticados...")
    
    headers = {'Authorization': f'Token {token}'}
    
    # Probar permisos
    try:
        response = requests.get(f'{BASE_URL}/api/permisos/', headers=headers)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Permisos obtenidos: {len(data['results'])} registros")
        else:
            print(f"❌ Error al obtener permisos: {response.status_code}")
    except Exception as e:
        print(f"❌ Error en permisos: {e}")
    
    # Probar configuración
    try:
        response = requests.get(f'{BASE_URL}/api/configuracion/', headers=headers)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Configuraciones obtenidas: {len(data['results'])} registros")
        else:
            print(f"❌ Error al obtener configuraciones: {response.status_code}")
    except Exception as e:
        print(f"❌ Error en configuraciones: {e}")
    
    # Probar auditoría
    try:
        response = requests.get(f'{BASE_URL}/api/auditoria/', headers=headers)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Auditoría obtenida: {len(data['results'])} registros")
        else:
            print(f"❌ Error al obtener auditoría: {response.status_code}")
    except Exception as e:
        print(f"❌ Error en auditoría: {e}")

def main():
    """Función principal de pruebas"""
    print("🚀 Iniciando pruebas de APIs de Core...")
    
    # 1. Health Check
    if not test_health_check():
        print("\n❌ El servidor no está disponible. Asegúrate de que esté ejecutándose.")
        return
    
    # 2. Registro
    token = test_register()
    if not token:
        print("\n❌ No se pudo registrar el usuario. Probando con login...")
        token = test_login()
    
    # 3. Endpoints autenticados
    if token:
        test_authenticated_endpoints(token)
    
    print("\n🎉 Pruebas completadas!")
    print("\n📝 Resumen de endpoints disponibles:")
    print("   - GET  /api/core/health/")
    print("   - POST /api/core/auth/register/")
    print("   - POST /api/core/auth/login/")
    print("   - POST /api/core/auth/logout/")
    print("   - CRUD /api/core/api/permisos/")
    print("   - CRUD /api/core/api/configuracion/")
    print("   - READ /api/core/api/auditoria/")
    print("   - READ /api/core/api/usuarios-basico/")

if __name__ == '__main__':
    main()