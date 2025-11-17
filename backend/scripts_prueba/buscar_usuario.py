#!/usr/bin/env python
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.contrib.auth import get_user_model
from apps.empleados.models import Empleado

User = get_user_model()

print("\n=== Buscando usuario 'Ivan Gimenez' ===\n")

# Buscar por nombre
users = User.objects.filter(
    first_name__icontains="ivan", last_name__icontains="gimenez"
)

for user in users:
    print(f"User ID: {user.id}")
    print(f"Username: {user.username}")
    print(f"Nombre: {user.get_full_name()}")
    print(f"Email: {user.email}")
    print(f"Rol: {user.role}")

    # Verificar si tiene perfil de empleado
    try:
        empleado = Empleado.objects.get(user=user)
        print(f"✅ Empleado ID: {empleado.id}")
        print(f"   Especialidad: {empleado.get_especialidades_display()}")

        # Verificar turnos
        from apps.turnos.models import Turno

        turnos = Turno.objects.filter(empleado=empleado)
        print(f"   Total turnos: {turnos.count()}")

    except Empleado.DoesNotExist:
        print("❌ NO tiene perfil de empleado")

    print()
