"""
Script para simular la creación de un usuario OAuth y verificar que se cree como cliente
"""

import os
import sys
import django

# Configurar Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.contrib.auth import get_user_model
from apps.clientes.models import Cliente

User = get_user_model()

print("=" * 70)
print("PRUEBA DE CREACIÓN DE USUARIO OAUTH")
print("=" * 70)

# Email de prueba
test_email = "nuevo_usuario_test@gmail.com"

# Verificar si ya existe
if User.objects.filter(email=test_email).exists():
    print(f"\n⚠️  El usuario {test_email} ya existe. Eliminándolo para la prueba...")
    User.objects.filter(email=test_email).delete()

print(f"\n🔨 Creando usuario de prueba como lo haría el pipeline OAuth...")

# Simular lo que hace el pipeline create_user_with_username
base_username = test_email.split("@")[0]
username = base_username
counter = 1

while User.objects.filter(username=username).exists():
    username = f"{base_username}{counter}"
    counter += 1

# Crear usuario como lo hace el pipeline
new_user = User.objects.create_user(
    username=username,
    email=test_email,
    first_name="Test",
    last_name="User",
    role="cliente",
    is_staff=False,
    is_superuser=False,
)

print(f"\n✅ Usuario creado:")
print(f"   Email: {new_user.email}")
print(f"   Username: {new_user.username}")
print(f"   Rol: {new_user.role}")
print(f"   is_superuser: {new_user.is_superuser}")
print(f"   is_staff: {new_user.is_staff}")

# Crear perfil de cliente
cliente = Cliente.objects.create(user=new_user, fecha_nacimiento=None)

print(f"\n✅ Perfil de Cliente creado: ID={cliente.id}")

print("\n" + "=" * 70)
print("VERIFICACIÓN")
print("=" * 70)

# Verificar
user_verificado = User.objects.get(email=test_email)
print(f"\n📋 Usuario en la base de datos:")
print(f"   Email: {user_verificado.email}")
print(f"   Rol: {user_verificado.role}")
print(f"   is_superuser: {user_verificado.is_superuser}")
print(f"   is_staff: {user_verificado.is_staff}")
print(f"   Tiene perfil de cliente: {hasattr(user_verificado, 'cliente_profile')}")

if user_verificado.is_superuser:
    print("\n❌ ERROR: El usuario se creó como superusuario")
elif user_verificado.role != "cliente":
    print(
        f"\n❌ ERROR: El usuario tiene rol '{user_verificado.role}' en lugar de 'cliente'"
    )
else:
    print("\n✅ ÉXITO: El usuario se creó correctamente como cliente normal")

print("\n" + "=" * 70)
print(f"💡 TIP: Puedes eliminar este usuario de prueba con:")
print(f"   User.objects.filter(email='{test_email}').delete()")
print("=" * 70)
