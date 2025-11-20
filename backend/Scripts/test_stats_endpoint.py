"""
Script para probar el endpoint de estadísticas del profesional
"""

import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "beautiful_studio_backend.settings")
django.setup()

import requests
from apps.users.models import User
from apps.empleados.models import Empleado

def test_stats_endpoint():
    """Probar el endpoint /empleados/{id}/stats/"""
    
    # URL base
    BASE_URL = "http://localhost:8000"
    
    print("=" * 60)
    print("TEST: Endpoint de Estadísticas del Profesional")
    print("=" * 60)
    
    # 1. Obtener un profesional de prueba
    try:
        user_profesional = User.objects.filter(role='profesional').first()
        if not user_profesional:
            print("❌ No hay usuarios con rol 'profesional'")
            return
        
        empleado = Empleado.objects.get(user=user_profesional)
        print(f"\n✅ Profesional encontrado: {empleado.nombre_completo} (ID: {empleado.id})")
        
    except Exception as e:
        print(f"❌ Error obteniendo profesional: {e}")
        return
    
    # 2. Login
    print("\n" + "-" * 60)
    print("LOGIN")
    print("-" * 60)
    
    login_data = {
        "dni": user_profesional.dni,
        "password": "Password123!"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login/", json=login_data)
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("access")
            print(f"✅ Login exitoso")
            print(f"   Token: {token[:20]}...")
        else:
            print(f"❌ Error en login: {response.status_code}")
            print(f"   Respuesta: {response.text}")
            return
    except Exception as e:
        print(f"❌ Error en request de login: {e}")
        return
    
    # 3. Probar endpoint de estadísticas
    print("\n" + "-" * 60)
    print("ESTADÍSTICAS DEL PROFESIONAL")
    print("-" * 60)
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/empleados/{empleado.id}/stats/",
            headers=headers
        )
        
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            stats = response.json()
            print("\n✅ Estadísticas obtenidas exitosamente:")
            print(f"\n   📅 Turnos hoy: {stats.get('turnos_hoy', 0)}")
            print(f"   📅 Turnos esta semana: {stats.get('turnos_semana', 0)}")
            print(f"   ✅ Turnos completados (mes): {stats.get('turnos_completados', 0)}")
            print(f"   💰 Ingresos del mes: ${stats.get('ingresos_mes', 0):.2f}")
            print(f"   ⭐ Calificación promedio: {stats.get('calificacion_promedio', 0):.1f}")
        else:
            print(f"\n❌ Error obteniendo estadísticas")
            print(f"   Respuesta: {response.text}")
            
    except Exception as e:
        print(f"❌ Error en request: {e}")
    
    # 4. Verificar restricción de acceso (otro profesional no debe ver las stats)
    print("\n" + "-" * 60)
    print("VERIFICACIÓN DE PERMISOS")
    print("-" * 60)
    
    # Intentar con otro profesional si existe
    otro_profesional = User.objects.filter(role='profesional').exclude(id=user_profesional.id).first()
    
    if otro_profesional:
        try:
            otro_empleado = Empleado.objects.get(user=otro_profesional)
            
            # Login con otro profesional
            login_data2 = {
                "dni": otro_profesional.dni,
                "password": "Password123!"
            }
            
            response = requests.post(f"{BASE_URL}/api/auth/login/", json=login_data2)
            
            if response.status_code == 200:
                token2 = response.json().get("access")
                
                # Intentar ver stats del primer profesional
                headers2 = {
                    "Authorization": f"Bearer {token2}",
                    "Content-Type": "application/json"
                }
                
                response = requests.get(
                    f"{BASE_URL}/api/empleados/{empleado.id}/stats/",
                    headers=headers2
                )
                
                if response.status_code == 403:
                    print(f"\n✅ Restricción de acceso funcionando correctamente")
                    print(f"   Un profesional no puede ver las stats de otro")
                else:
                    print(f"\n⚠️  Advertencia: Se esperaba 403, se obtuvo {response.status_code}")
        except Exception as e:
            print(f"⚠️  No se pudo verificar restricción de acceso: {e}")
    else:
        print("\n⚠️  Solo hay un profesional, no se puede verificar restricción de acceso")
    
    print("\n" + "=" * 60)
    print("FIN DEL TEST")
    print("=" * 60)

if __name__ == "__main__":
    test_stats_endpoint()
