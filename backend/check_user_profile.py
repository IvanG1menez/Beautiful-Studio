#!/usr/bin/env python
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "beautiful_studio_backend.settings")
django.setup()

from django.contrib.auth import get_user_model
from apps.empleados.models import Empleado
from apps.turnos.models import Turno

User = get_user_model()

user = User.objects.get(email="pro.adriana.cruz.pro636292@gmail.com")

print(f"\n=== Usuario ===")
print(f"User ID: {user.id}")
print(f"Email: {user.email}")
print(f"Role: {user.role}")

print(f"\n=== Verificación de profesional_profile ===")
print(f"Has profesional_profile: {hasattr(user, 'profesional_profile')}")

try:
    prof_profile = user.profesional_profile
    print(f"✅ profesional_profile.id: {prof_profile.id}")
except Exception as e:
    print(f"❌ Error al acceder: {e}")

print(f"\n=== Turno ===")
turno = Turno.objects.get(id=71)
print(f"Turno ID: {turno.id}")
print(f"Turno empleado ID: {turno.empleado.id}")

print(f"\n=== Comparación ===")
if hasattr(user, "profesional_profile"):
    print(
        f"user.profesional_profile.id == turno.empleado.id: {user.profesional_profile.id == turno.empleado.id}"
    )
