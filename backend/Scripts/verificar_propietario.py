"""
Script para verificar usuario propietario y endpoint SSO
"""
import os
import sys
import django

# Configurar Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

User = get_user_model()

# Buscar propietario
propietario = User.objects.filter(role='propietario').first()

if propietario:
    print(f"✅ Propietario encontrado: {propietario.email}")
    
    # Obtener o crear token
    token, created = Token.objects.get_or_create(user=propietario)
    print(f"Token: {token.key}")
    
    print("\n📝 Para probar el endpoint privado, usa:")
    print(f'curl -H "Authorization: Token {token.key}" http://127.0.0.1:8000/api/configuracion/sso/')
else:
    print("❌ No existe ningún usuario con rol 'propietario'")
    print("\n📝 Para crear uno:")
    print("1. python manage.py createsuperuser")
    print("2. Accede a /admin/ y cambia el rol a 'propietario'")
