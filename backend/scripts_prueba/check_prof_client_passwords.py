"""
Script para probar login de profesionales y clientes
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
print("PROBANDO CONTRASEÑAS DE PROFESIONALES Y CLIENTES")
print("="*60 + "\n")

# Contraseñas comunes a probar
passwords_to_test = ['password123', 'profesional123', 'cliente123', '123456', 'password', 'test123']

# Obtener primeros profesionales y clientes
profesionales = User.objects.filter(role='profesional')[:5]
clientes = User.objects.filter(role='cliente')[:5]

print(f"📋 PROFESIONALES ({profesionales.count()} en total):\n")
for user in profesionales:
    print(f"   Email: {user.email}")
    print(f"   Nombre: {user.first_name} {user.last_name}")
    
    password_found = None
    for pwd in passwords_to_test:
        if check_password(pwd, user.password):
            password_found = pwd
            break
    
    if password_found:
        print(f"   ✅ Contraseña: {password_found}")
    else:
        print(f"   ❌ Contraseña: DESCONOCIDA")
    print("")

print("\n" + "="*60)
print(f"📋 CLIENTES ({clientes.count()} en total):\n")
for user in clientes:
    print(f"   Email: {user.email}")
    print(f"   Nombre: {user.first_name} {user.last_name}")
    
    password_found = None
    for pwd in passwords_to_test:
        if check_password(pwd, user.password):
            password_found = pwd
            break
    
    if password_found:
        print(f"   ✅ Contraseña: {password_found}")
    else:
        print(f"   ❌ Contraseña: DESCONOCIDA")
    print("")

print("\n" + "="*60)
print("¿Quieres resetear TODAS las contraseñas? (s/n)")
print("="*60)
