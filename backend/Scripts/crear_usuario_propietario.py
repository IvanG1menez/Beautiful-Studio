"""
Script para crear un usuario con rol de propietario
Incluye todos los campos necesarios para la BD
"""

import os
import sys
import django

# Configurar Django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

User = get_user_model()


def crear_propietario():
    """
    Crea un usuario con rol de propietario con datos generales
    """

    print("\n" + "=" * 60)
    print("CREAR USUARIO PROPIETARIO")
    print("=" * 60)

    # Datos del propietario (valores por defecto generales)
    datos_usuario = {
        "email": "propietario@beautifulstudio.com",
        "username": "propietario",
        "first_name": "Propietario",
        "last_name": "Beautiful Studio",
        "phone": "+54 9 11 1234-5678",
        "dni": "12345678",
        "role": "propietario",
        "is_active": True,
        "is_staff": True,  # Permite acceso al admin de Django
    }

    password = "propietario123"  # Contraseña por defecto

    # Verificar si ya existe un usuario con ese email
    if User.objects.filter(email=datos_usuario["email"]).exists():
        print(f"\n⚠️  Ya existe un usuario con el email: {datos_usuario['email']}")
        usuario = User.objects.get(email=datos_usuario["email"])
        print(f"\nUsuario existente:")
        print(f"  - Email: {usuario.email}")
        print(f"  - Username: {usuario.username}")
        print(f"  - Nombre completo: {usuario.full_name}")
        print(f"  - Rol: {usuario.role}")
        print(f"  - DNI: {usuario.dni or 'No especificado'}")
        print(f"  - Teléfono: {usuario.phone or 'No especificado'}")
        print(f"  - Activo: {usuario.is_active}")

        # Preguntar si quiere actualizar el usuario
        respuesta = input("\n¿Deseas actualizar este usuario a propietario? (s/n): ")
        if respuesta.lower() == "s":
            usuario.role = "propietario"
            usuario.is_staff = True
            usuario.save()
            print("\n✅ Usuario actualizado exitosamente a rol propietario")

        # Generar token
        token, created = Token.objects.get_or_create(user=usuario)
        print(f"\n🔑 Token de autenticación: {token.key}")

        return usuario

    # Verificar si ya existe un usuario con ese username
    if User.objects.filter(username=datos_usuario["username"]).exists():
        print(f"\n⚠️  Ya existe un usuario con el username: {datos_usuario['username']}")
        print("Generando username alternativo...")
        base_username = datos_usuario["username"]
        counter = 1
        while User.objects.filter(username=f"{base_username}{counter}").exists():
            counter += 1
        datos_usuario["username"] = f"{base_username}{counter}"
        print(f"✅ Nuevo username: {datos_usuario['username']}")

    # Crear el usuario
    try:
        usuario = User.objects.create_user(password=password, **datos_usuario)

        print(f"\n✅ Usuario propietario creado exitosamente!")
        print(f"\n📋 Detalles del usuario:")
        print(f"  - Email: {usuario.email}")
        print(f"  - Username: {usuario.username}")
        print(f"  - Nombre completo: {usuario.full_name}")
        print(f"  - Rol: {usuario.role}")
        print(f"  - DNI: {usuario.dni}")
        print(f"  - Teléfono: {usuario.phone}")
        print(f"  - Contraseña: {password}")
        print(f"  - Activo: {usuario.is_active}")
        print(f"  - Staff (acceso admin): {usuario.is_staff}")

        # Crear token de autenticación
        token, created = Token.objects.get_or_create(user=usuario)
        print(f"\n🔑 Token de autenticación: {token.key}")

        print(f"\n📝 Credenciales de acceso:")
        print(f"  Email: {usuario.email}")
        print(f"  Contraseña: {password}")

        print(f"\n🌐 URLs de acceso:")
        print(f"  - Dashboard: http://localhost:3000/dashboard/propietario")
        print(f"  - Admin Django: http://127.0.0.1:8000/admin/")

        print(f"\n{'='*60}")

        return usuario

    except Exception as e:
        print(f"\n❌ Error al crear el usuario: {str(e)}")
        import traceback

        traceback.print_exc()
        return None


if __name__ == "__main__":
    usuario = crear_propietario()

    if usuario:
        print("\n✅ Proceso completado exitosamente")
    else:
        print("\n❌ Proceso completado con errores")
