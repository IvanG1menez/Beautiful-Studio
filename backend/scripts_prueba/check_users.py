"""
Script simple para verificar usuarios y sus contraseñas
Ejecutar desde backend/: python Scripts/check_users.py
"""

import os
import sys
import django

# Configurar Django
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.users.models import User
from django.contrib.auth.hashers import check_password

print("\n" + "="*60)
print("VERIFICACIÓN DE USUARIOS")
print("="*60 + "\n")

users = User.objects.all().order_by('id')

if users.count() == 0:
    print("❌ No hay usuarios en el sistema")
else:
    print(f"Total de usuarios: {users.count()}\n")
    
    for user in users:
        status_icon = "✅" if user.is_active else "❌"
        print(f"{status_icon} ID {user.id}: {user.email}")
        print(f"   Nombre: {user.first_name} {user.last_name}")
        print(f"   Rol: {user.role}")
        print(f"   Activo: {user.is_active}")
        print(f"   Staff: {user.is_staff}")
        
        # Verificar si el hash de contraseña es válido
        if user.password and '$' in user.password:
            parts = user.password.split('$')
            algorithm = parts[0]
            print(f"   Hash válido: ✅ ({algorithm})")
        else:
            print(f"   Hash válido: ❌ INVÁLIDO - {user.password[:20]}")
            
        print("")

print("="*60)
print("\nPRUEBA DE CONTRASEÑA")
print("="*60 + "\n")

test_email = input("Email del usuario (o Enter para salir): ").strip()

if test_email:
    try:
        user = User.objects.get(email__iexact=test_email)
        print(f"\n✅ Usuario encontrado: {user.email}")
        
        test_password = input("Contraseña a probar: ").strip()
        
        if check_password(test_password, user.password):
            print("\n✅✅✅ CONTRASEÑA CORRECTA ✅✅✅")
            print(f"Puedes iniciar sesión con:")
            print(f"  Email: {user.email}")
            print(f"  Contraseña: {test_password}")
        else:
            print("\n❌ CONTRASEÑA INCORRECTA")
            print("\nPara resetear la contraseña, ejecuta:")
            print("  python Scripts/reset_password.py")
            
    except User.DoesNotExist:
        print(f"\n❌ No existe usuario con email: {test_email}")

print("")
