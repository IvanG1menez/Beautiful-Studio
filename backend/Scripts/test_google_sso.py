"""
Script de prueba para verificar el sistema de Google SSO
"""
import os
import sys
import django
import requests

# Configurar Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.authentication.models import ConfiguracionSSO
from apps.users.models import User
from apps.clientes.models import Cliente


def print_section(title):
    """Imprime una sección con formato"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70 + "\n")


def test_configuracion_sso():
    """Verifica que la configuración SSO existe"""
    print_section("1. VERIFICACIÓN DE CONFIGURACIÓN SSO")
    
    try:
        config = ConfiguracionSSO.get_config()
        print(f"✅ Configuración encontrada (ID: {config.id})")
        print(f"   - Google SSO Activo: {config.google_sso_activo}")
        print(f"   - Autocreación Cliente: {config.autocreacion_cliente_sso}")
        print(f"   - Client ID: {'Configurado' if config.client_id else 'No configurado'}")
        print(f"   - Client Secret: {'Configurado' if config.client_secret else 'No configurado'}")
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_endpoint_publico():
    """Verifica que el endpoint público funcione"""
    print_section("2. VERIFICACIÓN DE ENDPOINT PÚBLICO")
    
    try:
        url = "http://127.0.0.1:8000/api/auth/configuracion/sso/public/"
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Endpoint público responde correctamente")
            print(f"   URL: {url}")
            print(f"   Response: {data}")
            return True
        else:
            print(f"❌ Error: Status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Error: No se puede conectar al servidor")
        print("   Asegúrate de que el servidor Django esté corriendo:")
        print("   python manage.py runserver")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_pipeline():
    """Verifica que el pipeline esté configurado"""
    print_section("3. VERIFICACIÓN DE PIPELINE")
    
    from django.conf import settings
    
    pipeline = settings.SOCIAL_AUTH_PIPELINE
    custom_step = 'apps.authentication.pipeline.create_cliente_profile'
    
    if custom_step in pipeline:
        print(f"✅ Pipeline personalizado configurado correctamente")
        print(f"   Encontrado: {custom_step}")
        return True
    else:
        print(f"❌ Pipeline personalizado no encontrado en settings")
        return False


def test_social_django_installed():
    """Verifica que social_django esté instalado"""
    print_section("4. VERIFICACIÓN DE SOCIAL_DJANGO")
    
    from django.conf import settings
    
    if 'social_django' in settings.INSTALLED_APPS:
        print("✅ social_django está en INSTALLED_APPS")
        
        # Verificar que las migraciones estén aplicadas
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='social_auth_usersocialauth'"
            )
            if cursor.fetchone():
                print("✅ Tabla social_auth_usersocialauth existe")
                return True
            else:
                print("❌ Tabla social_auth_usersocialauth no existe")
                print("   Ejecuta: python manage.py migrate")
                return False
    else:
        print("❌ social_django no está en INSTALLED_APPS")
        return False


def test_authentication_backends():
    """Verifica que los backends estén configurados"""
    print_section("5. VERIFICACIÓN DE AUTHENTICATION BACKENDS")
    
    from django.conf import settings
    
    required_backends = [
        'social_core.backends.google.GoogleOAuth2',
        'apps.users.backends.EmailBackend',
        'django.contrib.auth.backends.ModelBackend'
    ]
    
    all_ok = True
    for backend in required_backends:
        if backend in settings.AUTHENTICATION_BACKENDS:
            print(f"✅ {backend.split('.')[-1]}")
        else:
            print(f"❌ {backend.split('.')[-1]} no encontrado")
            all_ok = False
    
    return all_ok


def test_google_credentials():
    """Verifica que las credenciales de Google estén configuradas"""
    print_section("6. VERIFICACIÓN DE CREDENCIALES GOOGLE")
    
    from django.conf import settings
    
    client_id = settings.SOCIAL_AUTH_GOOGLE_OAUTH2_KEY
    client_secret = settings.SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET
    
    if client_id and client_secret:
        print(f"✅ Credenciales configuradas en settings")
        print(f"   Client ID: {client_id[:20]}...")
        print(f"   Client Secret: {'*' * 20}")
        return True
    else:
        print("⚠️  Credenciales no configuradas en variables de entorno")
        print("   Configúralas desde:")
        print("   - Variables de entorno (.env)")
        print("   - Django Admin (/admin/)")
        print("   - Dashboard Propietario (/dashboard/propietario/configuracion-sso)")
        
        # Verificar si están en BD
        config = ConfiguracionSSO.get_config()
        if config.client_id and config.client_secret:
            print("\n✅ Credenciales encontradas en base de datos")
            return True
        else:
            print("\n❌ Credenciales tampoco están en base de datos")
            return False


def test_urls():
    """Verifica que las URLs estén configuradas"""
    print_section("7. VERIFICACIÓN DE URLs")
    
    from django.urls import resolve, reverse
    
    urls_to_test = [
        '/api/auth/configuracion/sso/',
        '/api/auth/configuracion/sso/public/',
    ]
    
    all_ok = True
    for url in urls_to_test:
        try:
            resolve(url)
            print(f"✅ {url}")
        except Exception as e:
            print(f"❌ {url} - Error: {e}")
            all_ok = False
    
    return all_ok


def run_all_tests():
    """Ejecuta todos los tests"""
    print("\n" + "=" * 70)
    print("  SISTEMA DE PRUEBAS - GOOGLE SSO")
    print("=" * 70)
    
    results = {
        "Configuración SSO": test_configuracion_sso(),
        "Endpoint Público": test_endpoint_publico(),
        "Pipeline Personalizado": test_pipeline(),
        "Social Django": test_social_django_installed(),
        "Authentication Backends": test_authentication_backends(),
        "Credenciales Google": test_google_credentials(),
        "URLs Configuradas": test_urls(),
    }
    
    print_section("RESUMEN DE RESULTADOS")
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}  {test_name}")
    
    print(f"\n{'=' * 70}")
    print(f"  Total: {passed}/{total} pruebas pasadas")
    print(f"{'=' * 70}\n")
    
    if passed == total:
        print("🎉 ¡Todos los tests pasaron! Sistema de Google SSO listo para usar.")
        print("\n📝 Próximos pasos:")
        print("   1. Configura las credenciales de Google Cloud Console")
        print("   2. Actualiza GOOGLE_OAUTH2_CLIENT_ID y SECRET en .env")
        print("   3. O configúralas desde /dashboard/propietario/configuracion-sso")
        print("   4. Prueba el botón en /login o /register")
    else:
        print("⚠️  Algunos tests fallaron. Revisa los errores arriba.")
        print("\n📝 Comandos útiles:")
        print("   python manage.py migrate")
        print("   python manage.py runserver")
        print("   python Scripts/inicializar_sso.py")


if __name__ == '__main__':
    run_all_tests()
