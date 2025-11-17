"""
Script para resetear automáticamente la contraseña de admin@test.com
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'beautiful_studio_backend.settings')
django.setup()

from apps.users.models import User

print("\n" + "="*60)
print("RESETEANDO CONTRASEÑA DE admin@test.com")
print("="*60 + "\n")

try:
    user = User.objects.get(email='admin@test.com')
    
    # Nueva contraseña simple
    new_password = 'admin123'
    
    user.set_password(new_password)
    user.save()
    
    print(f"✅✅✅ CONTRASEÑA RESETEADA EXITOSAMENTE ✅✅✅\n")
    print(f"Usuario: {user.email}")
    print(f"Nombre: {user.first_name} {user.last_name}")
    print(f"Rol: {user.role}")
    print(f"\n🔑 NUEVAS CREDENCIALES:")
    print(f"   Email: {user.email}")
    print(f"   Contraseña: {new_password}\n")
    print(f"Ahora puedes iniciar sesión en:\n")
    print(f"   http://localhost:3000/login\n")
    print("="*60 + "\n")
    
except User.DoesNotExist:
    print("❌ No existe usuario con email: admin@test.com\n")
    sys.exit(1)
