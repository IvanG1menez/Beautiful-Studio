#!/usr/bin/env python
"""
Script para verificar si las tablas de authtoken están creadas
"""
import os
import sys
import django

# Configurar Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "beautiful_studio_backend.settings")
django.setup()

try:
    from rest_framework.authtoken.models import Token
    from django.contrib.auth import get_user_model

    User = get_user_model()

    print("✓ Token model importado correctamente")
    print(f"✓ Token objects manager disponible: {hasattr(Token, 'objects')}")

    # Verificar si las tablas existen
    try:
        token_count = Token.objects.count()
        print(f"✓ Tabla authtoken_token existe. Tokens existentes: {token_count}")
    except Exception as e:
        print(f"✗ Error al acceder a la tabla authtoken_token: {e}")
        print("  Solución: Ejecutar 'python manage.py migrate'")

    # Verificar usuarios
    try:
        user_count = User.objects.count()
        print(f"✓ Usuarios en la base de datos: {user_count}")
    except Exception as e:
        print(f"✗ Error al acceder a la tabla de usuarios: {e}")

except ImportError as e:
    print(f"✗ Error al importar Token: {e}")
    print("  Solución: Agregar 'rest_framework.authtoken' a INSTALLED_APPS")
