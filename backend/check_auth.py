"""
Script de diagnóstico para problemas de autenticación
Ejecutar: python manage.py shell < check_auth.py
"""

from apps.users.models import User
from django.contrib.auth.hashers import check_password

print("\n" + "="*60)
print("DIAGNÓSTICO DE AUTENTICACIÓN")
print("="*60 + "\n")

# Listar todos los usuarios
print("📋 USUARIOS EN EL SISTEMA:")
print("-" * 60)
users = User.objects.all()

for user in users:
    print(f"\nID: {user.id}")
    print(f"Email: {user.email}")
    print(f"Username: {user.username}")
    print(f"Nombre: {user.first_name} {user.last_name}")
    print(f"Rol: {user.role}")
    print(f"Activo: {'✅ Sí' if user.is_active else '❌ No'}")
    print(f"Staff: {'✅ Sí' if user.is_staff else '❌ No'}")
    print(f"Superuser: {'✅ Sí' if user.is_superuser else '❌ No'}")
    print(f"Hash de contraseña: {user.password[:50]}...")
    print(f"Algoritmo: {user.password.split('$')[0] if '$' in user.password else 'INVÁLIDO'}")
    print("-" * 60)

print("\n" + "="*60)
print("PRUEBA DE CONTRASEÑAS")
print("="*60 + "\n")

# Solicitar email y contraseña para probar
test_email = input("Ingresa el email a probar (o presiona Enter para saltar): ").strip()

if test_email:
    try:
        user = User.objects.get(email=test_email.lower())
        print(f"\n✅ Usuario encontrado: {user.email}")
        print(f"Rol: {user.role}")
        print(f"Activo: {user.is_active}")
        
        test_password = input("Ingresa la contraseña: ").strip()
        
        if check_password(test_password, user.password):
            print("\n✅ CONTRASEÑA CORRECTA")
        else:
            print("\n❌ CONTRASEÑA INCORRECTA")
            print(f"Hash almacenado: {user.password}")
            
    except User.DoesNotExist:
        print(f"\n❌ No existe usuario con email: {test_email}")

print("\n" + "="*60)
print("TOKENS DE AUTENTICACIÓN")
print("="*60 + "\n")

from rest_framework.authtoken.models import Token

tokens = Token.objects.all()
print(f"Total de tokens: {tokens.count()}\n")

for token in tokens:
    print(f"Usuario: {token.user.email}")
    print(f"Token: {token.key}")
    print(f"Creado: {token.created}")
    print("-" * 60)

print("\n✅ Diagnóstico completado\n")
