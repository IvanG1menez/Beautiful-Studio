"""
Resetear contraseñas de TODOS los usuarios a contraseñas simples por defecto
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.users.models import User

print("\n" + "="*60)
print("RESETEAR TODAS LAS CONTRASEÑAS")
print("="*60 + "\n")

# Contraseñas por rol
passwords = {
    'propietario': 'admin123',
    'profesional': 'profesional123',
    'cliente': 'cliente123'
}

usuarios_actualizados = []

for user in User.objects.all():
    password = passwords.get(user.role, 'password123')
    user.set_password(password)
    user.save()
    usuarios_actualizados.append({
        'email': user.email,
        'rol': user.role,
        'password': password
    })

print(f"✅ {len(usuarios_actualizados)} usuarios actualizados\n")
print("="*60)
print("CREDENCIALES ACTUALIZADAS")
print("="*60 + "\n")

# Mostrar resumen por rol
for rol in ['propietario', 'profesional', 'cliente']:
    users_rol = [u for u in usuarios_actualizados if u['rol'] == rol]
    if users_rol:
        print(f"\n📋 {rol.upper()} ({len(users_rol)} usuarios):")
        print(f"   Contraseña: {passwords[rol]}")
        print(f"   Usuarios:")
        for u in users_rol[:5]:  # Mostrar solo primeros 5
            print(f"      - {u['email']}")
        if len(users_rol) > 5:
            print(f"      ... y {len(users_rol) - 5} más")

print("\n" + "="*60)
print("RESUMEN DE CONTRASEÑAS POR ROL")
print("="*60)
for rol, pwd in passwords.items():
    print(f"  {rol}: {pwd}")
print("="*60 + "\n")
