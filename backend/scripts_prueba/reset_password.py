"""
Script para resetear contraseña de un usuario
Ejecutar desde backend/: python Scripts/reset_password.py
"""

import os
import sys
import django

# Configurar Django
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.users.models import User

print("\n" + "="*60)
print("RESETEAR CONTRASEÑA DE USUARIO")
print("="*60 + "\n")

# Listar usuarios
print("📋 USUARIOS DISPONIBLES:")
print("-" * 60)
users = User.objects.all().order_by('id')

for user in users:
    print(f"{user.id}. {user.email} - {user.first_name} {user.last_name} ({user.role})")

print("-" * 60 + "\n")

# Solicitar ID del usuario
try:
    user_id = int(input("Ingresa el ID del usuario: ").strip())
    user = User.objects.get(id=user_id)
    
    print(f"\n✅ Usuario seleccionado:")
    print(f"   Email: {user.email}")
    print(f"   Nombre: {user.first_name} {user.last_name}")
    print(f"   Rol: {user.role}")
    
    # Solicitar nueva contraseña
    new_password = input("\nIngresa la nueva contraseña: ").strip()
    
    if len(new_password) < 6:
        print("\n❌ La contraseña debe tener al menos 6 caracteres")
        sys.exit(1)
    
    # Confirmar contraseña
    confirm_password = input("Confirma la contraseña: ").strip()
    
    if new_password != confirm_password:
        print("\n❌ Las contraseñas no coinciden")
        sys.exit(1)
    
    # Cambiar contraseña
    user.set_password(new_password)
    user.save()
    
    print(f"\n✅ CONTRASEÑA CAMBIADA EXITOSAMENTE")
    print(f"   Usuario: {user.email}")
    print(f"   Nueva contraseña: {new_password}")
    print(f"\nPuedes iniciar sesión ahora con estas credenciales.\n")
    
except User.DoesNotExist:
    print(f"\n❌ No existe usuario con ID: {user_id}")
    sys.exit(1)
except ValueError:
    print("\n❌ ID inválido. Debe ser un número")
    sys.exit(1)
except KeyboardInterrupt:
    print("\n\n❌ Operación cancelada\n")
    sys.exit(0)
