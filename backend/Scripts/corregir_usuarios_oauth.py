"""
Script para corregir usuarios creados como superusuarios por Google OAuth
"""

import os
import sys
import django

# Configurar Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.contrib.auth import get_user_model
from social_django.models import UserSocialAuth

User = get_user_model()

print("=" * 70)
print("CORRECCIÓN DE USUARIOS OAUTH")
print("=" * 70)

# Buscar usuarios que tienen cuenta de Google OAuth
usuarios_oauth = UserSocialAuth.objects.filter(provider="google-oauth2")

print(
    f"\n✅ Encontrados {usuarios_oauth.count()} usuarios con cuenta de Google OAuth\n"
)

usuarios_corregidos = 0

for social_auth in usuarios_oauth:
    user = social_auth.user

    # Verificar si el usuario es superusuario pero NO debería serlo
    # (Los usuarios OAuth deberían ser clientes, no superusuarios)
    if user.is_superuser and user.role != "propietario" and user.role != "superusuario":
        print(f"⚠️  Usuario detectado con permisos incorrectos:")
        print(f"   Email: {user.email}")
        print(f"   Rol actual: {user.role}")
        print(f"   is_superuser: {user.is_superuser}")
        print(f"   is_staff: {user.is_staff}")

        # Corregir el usuario
        user.role = "cliente"
        user.is_superuser = False
        user.is_staff = False
        user.save()

        print(f"   ✅ CORREGIDO: Ahora es cliente normal (is_superuser=False)\n")
        usuarios_corregidos += 1
    else:
        print(
            f"✓ {user.email} - Configuración correcta (rol: {user.role}, is_superuser: {user.is_superuser})"
        )

print("\n" + "=" * 70)
print(f"RESUMEN")
print("=" * 70)
print(f"Total usuarios OAuth: {usuarios_oauth.count()}")
print(f"Usuarios corregidos: {usuarios_corregidos}")
print("=" * 70)

if usuarios_corregidos > 0:
    print("\n✅ Los usuarios han sido corregidos exitosamente")
else:
    print("\n✅ No se encontraron usuarios que necesiten corrección")
