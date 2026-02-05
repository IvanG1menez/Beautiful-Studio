"""
Script para verificar la configuración de Google SSO
"""

import os
import sys
import django

# Configurar Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.authentication.models import ConfiguracionSSO
from django.conf import settings

print("=" * 70)
print("VERIFICACIÓN DE CONFIGURACIÓN GOOGLE SSO")
print("=" * 70)

# 1. Verificar configuración en BD
try:
    config = ConfiguracionSSO.get_config()
    print("\n✅ Configuración encontrada en base de datos")
    print(f"   - Google SSO Activo: {config.google_sso_activo}")
    print(f"   - Autocreación Cliente: {config.autocreacion_cliente_sso}")
    print(f"   - Client ID: {config.client_id or 'NO CONFIGURADO'}")
    print(
        f"   - Client Secret: {'CONFIGURADO' if config.client_secret else 'NO CONFIGURADO'}"
    )
except Exception as e:
    print(f"\n❌ Error al obtener configuración de BD: {e}")

# 2. Verificar variables de entorno en settings
print("\n" + "=" * 70)
print("CONFIGURACIÓN EN SETTINGS.PY")
print("=" * 70)

client_id = settings.SOCIAL_AUTH_GOOGLE_OAUTH2_KEY
client_secret = settings.SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET
redirect_uri = settings.SOCIAL_AUTH_GOOGLE_OAUTH2_REDIRECT_URI

print(f"\n   - Client ID (settings): {client_id or 'NO CONFIGURADO'}")
print(
    f"   - Client Secret (settings): {'CONFIGURADO' if client_secret else 'NO CONFIGURADO'}"
)
print(f"   - Redirect URI: {redirect_uri}")

# 3. Diagnóstico
print("\n" + "=" * 70)
print("DIAGNÓSTICO")
print("=" * 70)

if not client_id and not client_secret:
    print("\n❌ PROBLEMA ENCONTRADO:")
    print("   Las credenciales de Google OAuth NO están configuradas.")
    print("\n📝 SOLUCIÓN:")
    print("   1. Ve a Google Cloud Console: https://console.cloud.google.com")
    print("   2. Crea o selecciona un proyecto")
    print("   3. Ve a 'APIs & Services' > 'Credentials'")
    print("   4. Crea 'OAuth 2.0 Client ID'")
    print("   5. Configura las URIs autorizadas:")
    print("      - http://localhost:8000")
    print("      - http://localhost:8000/api/auth/complete/google-oauth2/")
    print("\n   6. Opción 1 - Crear archivo .env en backend/:")
    print("      GOOGLE_OAUTH2_CLIENT_ID=tu_client_id_aqui")
    print("      GOOGLE_OAUTH2_CLIENT_SECRET=tu_client_secret_aqui")
    print("\n   7. Opción 2 - Usar el dashboard del propietario:")
    print("      http://localhost:3000/dashboard/propietario/configuracion-sso")
    print("      (Configura Client ID y Client Secret ahí)")
else:
    print("\n✅ Credenciales configuradas correctamente")
