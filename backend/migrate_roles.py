#!/usr/bin/env python
"""
Script para migrar roles antiguos a nuevos en la base de datos.
Convierte:
- 'admin' → 'propietario'
- 'empleado' → 'profesional'
"""

import os
import django

# Configurar Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "beautiful_studio_backend.settings")
django.setup()

from apps.users.models import User


def migrate_roles():
    """Migrar roles de usuarios"""

    print("🔄 Iniciando migración de roles...")
    print("-" * 50)

    # Contar usuarios antes de la migración
    admin_count = User.objects.filter(role="admin").count()
    empleado_count = User.objects.filter(role="empleado").count()

    print(f"📊 Usuarios a migrar:")
    print(f"   - 'admin' → 'propietario': {admin_count} usuarios")
    print(f"   - 'empleado' → 'profesional': {empleado_count} usuarios")
    print()

    if admin_count == 0 and empleado_count == 0:
        print("✅ No hay usuarios con roles antiguos. ¡Migración ya completada!")
        return

    # Migrar admin → propietario
    usuarios_admin = User.objects.filter(role="admin").update(role="propietario")
    print(f"✅ {usuarios_admin} usuarios 'admin' → 'propietario'")

    # Migrar empleado → profesional
    usuarios_empleado = User.objects.filter(role="empleado").update(role="profesional")
    print(f"✅ {usuarios_empleado} usuarios 'empleado' → 'profesional'")

    print()
    print("-" * 50)
    print("✨ Migración completada exitosamente!")
    print()

    # Mostrar resumen de roles actuales
    print("📊 Distribución actual de roles:")
    for role_key, role_label in User.ROLE_CHOICES:
        count = User.objects.filter(role=role_key).count()
        if count > 0:
            print(f"   - {role_label}: {count} usuarios")


if __name__ == "__main__":
    migrate_roles()
