"""
Script para probar login con admin@test.com
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.users.models import User
from django.contrib.auth.hashers import check_password

print("\n" + "="*60)
print("PROBANDO CONTRASEÑAS PARA admin@test.com")
print("="*60 + "\n")

try:
    user = User.objects.get(email='admin@test.com')
    print(f"✅ Usuario encontrado: {user.email}")
    print(f"   Nombre: {user.first_name} {user.last_name}")
    print(f"   Rol: {user.role}")
    print(f"   Activo: {user.is_active}")
    print(f"\n🔑 Probando contraseñas comunes:\n")
    
    passwords = ['admin123', 'admin', 'password', '123456', 'test123', 'admin@test.com']
    
    for pwd in passwords:
        result = check_password(pwd, user.password)
        icon = "✅" if result else "❌"
        print(f"   {icon} {pwd}: {'CORRECTA' if result else 'incorrecta'}")
        
        if result:
            print(f"\n🎉🎉🎉 ¡CONTRASEÑA ENCONTRADA! 🎉🎉🎉")
            print(f"\nCredenciales de login:")
            print(f"  Email: {user.email}")
            print(f"  Contraseña: {pwd}\n")
            sys.exit(0)
    
    print(f"\n❌ Ninguna contraseña común funciona.")
    print(f"\nDebes resetear la contraseña con:")
    print(f"  python Scripts/reset_password.py")
    print(f"\nY seleccionar el usuario ID: {user.id}\n")
    
except User.DoesNotExist:
    print("❌ No existe usuario con email: admin@test.com\n")
