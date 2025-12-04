"""
Script para verificar si el usuario de Google tiene perfil de Cliente
"""
import sys
import os
import django

# Agregar el directorio backend al path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
django.setup()

from apps.clientes.models import Cliente
from django.contrib.auth import get_user_model

User = get_user_model()

# Buscar usuario de Google
try:
    user = User.objects.get(email='gimenezivanb@gmail.com')
    print(f"\n=== USUARIO DE GOOGLE ===")
    print(f"ID: {user.id}")
    print(f"Email: {user.email}")
    print(f"Username: {user.username}")
    print(f"Nombre: {user.first_name} {user.last_name}")
    print(f"Role: {user.role}")
    print(f"Activo: {user.is_active}")
    
    # Verificar perfil de cliente
    print(f"\n=== PERFIL DE CLIENTE ===")
    try:
        cliente = Cliente.objects.get(user=user)
        print(f"✅ TIENE PERFIL DE CLIENTE")
        print(f"Cliente ID: {cliente.id}")
        print(f"Nombre completo: {cliente.nombre_completo}")
        print(f"Fecha nacimiento: {cliente.fecha_nacimiento}")
        print(f"Dirección: {cliente.direccion}")
        print(f"Teléfono: {user.phone}")
    except Cliente.DoesNotExist:
        print(f"❌ NO TIENE PERFIL DE CLIENTE")
        print(f"\nCreando perfil de cliente...")
        cliente = Cliente.objects.create(
            user=user,
            fecha_nacimiento=None
        )
        print(f"✅ Perfil de cliente creado: ID={cliente.id}")
        
except User.DoesNotExist:
    print("❌ Usuario con email gimenezivanb@gmail.com NO encontrado")
    print("\nVerificando últimos usuarios creados...")
    recent_users = User.objects.filter(role='cliente').order_by('-id')[:5]
    for u in recent_users:
        print(f"  - {u.email} (ID: {u.id}, Username: {u.username})")
