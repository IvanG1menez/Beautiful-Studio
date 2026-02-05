"""
Script para inicializar la configuración de Google SSO
"""

import os
import sys
import django

# Configurar Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.authentication.models import ConfiguracionSSO


def inicializar_sso():
    """
    Crea o actualiza la configuración de SSO
    """
    print("=" * 60)
    print("INICIALIZACIÓN DE CONFIGURACIÓN GOOGLE SSO")
    print("=" * 60)

    # Obtener o crear configuración
    config, created = ConfiguracionSSO.objects.get_or_create(
        pk=1,
        defaults={
            "google_sso_activo": True,
            "autocreacion_cliente_sso": True,
            "activo": True,
        },
    )

    if created:
        print("\n✅ Configuración SSO creada exitosamente")
    else:
        print("\n✅ Configuración SSO ya existe")

    print(f"\nID: {config.id}")
    print(f"Google SSO Activo: {'✅ Sí' if config.google_sso_activo else '❌ No'}")
    print(
        f"Autocreación de Cliente: {'✅ Sí' if config.autocreacion_cliente_sso else '❌ No'}"
    )
    print(f"Client ID configurado: {'✅ Sí' if config.client_id else '❌ No'}")
    print(f"Client Secret configurado: {'✅ Sí' if config.client_secret else '❌ No'}")

    print("\n" + "=" * 60)
    print("ENDPOINTS DISPONIBLES")
    print("=" * 60)
    print("\n📍 Endpoint Público (GET):")
    print("   GET /api/configuracion/sso/public/")
    print("   - Sin autenticación requerida")
    print("   - Retorna: google_sso_activo, autocreacion_cliente_sso")

    print("\n📍 Endpoint Privado (GET/PATCH):")
    print("   GET/PATCH /api/auth/configuracion/sso/")
    print("   - Requiere autenticación (Token)")
    print("   - Solo accesible por propietario")
    print("   - Retorna/actualiza toda la configuración")

    print("\n📍 Endpoint de OAuth:")
    print("   GET /api/auth/login/google-oauth2/")
    print("   - Inicia el flujo de autenticación con Google")

    print("\n" + "=" * 60)
    print("PASOS SIGUIENTES")
    print("=" * 60)
    print(
        """
1. Configurar credenciales de Google Cloud Console:
   - Ve a https://console.cloud.google.com
   - Crea OAuth 2.0 Client ID
   - Agrega URLs autorizadas:
     * http://localhost:8000
     * http://localhost:8000/api/auth/complete/google-oauth2/
   
2. Actualizar variables de entorno (.env):
   GOOGLE_OAUTH2_CLIENT_ID=tu_client_id
   GOOGLE_OAUTH2_CLIENT_SECRET=tu_client_secret
   GOOGLE_OAUTH2_REDIRECT_URI=http://localhost:8000/api/auth/complete/google-oauth2/
   
3. O configurar desde el panel de administración:
   - Accede a /admin/ como propietario
   - Ve a "Configuración SSO"
   - Ingresa Client ID y Client Secret
   
4. O configurar desde el dashboard del propietario:
   - Accede a /dashboard/propietario/configuracion-sso
   - Configura las credenciales de Google OAuth
    """
    )

    print("\n✅ Inicialización completada")
    print("=" * 60)


if __name__ == "__main__":
    inicializar_sso()
