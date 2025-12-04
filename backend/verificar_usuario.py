#!/usr/bin/env python
"""Script para verificar el usuario y su token"""
import os
import sys
import django

# Configurar Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'beautiful_studio_backend.settings')
django.setup()

from apps.users.models import CustomUser
from rest_framework.authtoken.models import Token

# Buscar usuario con el token usado en el frontend
token_key = "5c421478db7a2aea913d0ac1291bb763d4bd8fd2"

try:
    token = Token.objects.get(key=token_key)
    user = token.user
    print(f"\n✅ Token encontrado")
    print(f"Usuario: {user.email}")
    print(f"Username: {user.username}")
    print(f"Rol: {user.role}")
    print(f"Activo: {user.is_active}")
    print(f"Es propietario: {user.role == 'propietario'}")
except Token.DoesNotExist:
    print(f"\n❌ Token no encontrado: {token_key}")
