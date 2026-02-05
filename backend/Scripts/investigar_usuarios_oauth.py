"""
Script para investigar usuarios OAuth en detalle
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
print("INVESTIGACIÓN DE USUARIOS OAUTH")
print("=" * 70)

# Listar todos los usuarios
all_users = User.objects.all()

print(f"\n📊 Total de usuarios en la base de datos: {all_users.count()}\n")

for user in all_users:
    # Verificar si tiene cuenta OAuth
    has_oauth = UserSocialAuth.objects.filter(user=user).exists()
    oauth_provider = ""

    if has_oauth:
        oauth_accounts = UserSocialAuth.objects.filter(user=user)
        providers = [acc.provider for acc in oauth_accounts]
        oauth_provider = f" [OAuth: {', '.join(providers)}]"

    print(f"ID: {user.id} | {user.email}")
    print(f"   Username: {user.username}")
    print(f"   Rol: {user.role}")
    print(f"   is_superuser: {user.is_superuser}")
    print(f"   is_staff: {user.is_staff}")
    print(f"   {oauth_provider}")
    print()

print("=" * 70)

# Listar cuentas OAuth duplicadas
print("\n🔍 Verificando cuentas OAuth duplicadas...\n")
oauth_accounts = UserSocialAuth.objects.all()

for oauth in oauth_accounts:
    print(f"Provider: {oauth.provider}")
    print(f"UID: {oauth.uid}")
    print(f"Usuario: {oauth.user.email} (ID: {oauth.user.id})")
    print(f"User role: {oauth.user.role}")
    print()
