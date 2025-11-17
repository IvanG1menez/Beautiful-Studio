#!/usr/bin/env python
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.contrib.auth import get_user_model
from apps.turnos.models import Turno

User = get_user_model()

user = User.objects.get(email="pro.adriana.cruz.pro636292@gmail.com")
print(f"\n=== Usuario autenticado ===")
print(f"User ID: {user.id}")
print(f"Email: {user.email}")

print(f"\n=== Intentando simular get_queryset() ===")

# Simular lo que hace el ViewSet
queryset = Turno.objects.select_related(
    "cliente__user", "empleado__user", "servicio__categoria"
).all()

# Aplicar filtro si es profesional
if hasattr(user, "profesional_profile"):
    queryset = queryset.filter(empleado=user.profesional_profile)
    print(f"✅ Filtrado por profesional_profile (ID: {user.profesional_profile.id})")

print(f"\nTotal turnos en queryset: {queryset.count()}")

# Intentar obtener el turno 71
turno_id = 71
try:
    turno = queryset.get(id=turno_id)
    print(f"\n✅ Turno {turno_id} encontrado:")
    print(f"   Cliente: {turno.cliente.nombre_completo}")
    print(f"   Empleado: {turno.empleado.user.get_full_name()}")
    print(f"   Estado actual: {turno.estado}")

    # Simular actualización
    print(f"\n=== Simulando actualización a 'confirmado' ===")
    turno.estado = "confirmado"
    turno.save()
    print(f"✅ Estado actualizado correctamente")

except Turno.DoesNotExist:
    print(f"\n❌ ERROR: Turno {turno_id} no encontrado en el queryset")
    print(f"   Esto explicaría el error 'No Turno matches the given query'")
