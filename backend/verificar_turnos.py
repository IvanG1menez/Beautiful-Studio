#!/usr/bin/env python
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "beautiful_studio_backend.settings")
django.setup()

from apps.turnos.models import Turno
from apps.empleados.models import Empleado
from datetime import datetime, timedelta

print("\n=== TURNOS RECIENTES EN LA BASE DE DATOS ===\n")

# Obtener turnos de los últimos 30 días y próximos 30 días
fecha_inicio = datetime.now() - timedelta(days=30)
fecha_fin = datetime.now() + timedelta(days=30)

turnos = (
    Turno.objects.filter(fecha_hora__range=[fecha_inicio, fecha_fin])
    .select_related("cliente__user", "empleado__user", "servicio")
    .order_by("-fecha_hora")
)

print(f"Total de turnos encontrados: {turnos.count()}\n")

if turnos.exists():
    for i, turno in enumerate(turnos[:20], 1):  # Mostrar los primeros 20
        print(f"{i}. ID: {turno.id}")
        print(f"   Fecha/Hora: {turno.fecha_hora.strftime('%Y-%m-%d %H:%M')}")
        print(f"   Cliente: {turno.cliente.nombre_completo} (ID: {turno.cliente.id})")
        print(
            f"   Empleado: {turno.empleado.user.get_full_name()} (Empleado ID: {turno.empleado.id}, User ID: {turno.empleado.user.id})"
        )
        print(f"   Servicio: {turno.servicio.nombre}")
        print(f"   Estado: {turno.estado}")
        print(f"   Precio: ${turno.precio_final}")
        print()
else:
    print("❌ NO HAY TURNOS EN LA BASE DE DATOS")

# Mostrar información de los empleados que tienen turnos
print("\n=== EMPLEADOS CON TURNOS ===\n")
empleados_con_turnos = Empleado.objects.filter(
    turnos_asignados__fecha_hora__range=[fecha_inicio, fecha_fin]
).distinct()

for emp in empleados_con_turnos:
    count = Turno.objects.filter(
        empleado=emp, fecha_hora__range=[fecha_inicio, fecha_fin]
    ).count()
    print(f"Empleado ID: {emp.id} | User ID: {emp.user.id}")
    print(f"  Nombre: {emp.user.get_full_name()}")
    print(f"  Username: {emp.user.username}")
    print(f"  Email: {emp.user.email}")
    print(f"  Turnos: {count}")
    print()
