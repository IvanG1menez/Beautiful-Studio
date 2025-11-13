#!/usr/bin/env python
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "beautiful_studio_backend.settings")
django.setup()

from apps.turnos.models import Turno
from datetime import datetime

empleado_id = 71

print(f"\n=== TODOS LOS TURNOS DEL EMPLEADO {empleado_id} ===\n")

turnos = Turno.objects.filter(empleado_id=empleado_id).order_by("fecha_hora")

print(f"Total de turnos: {turnos.count()}\n")

if turnos.exists():
    for i, t in enumerate(turnos, 1):
        print(f"{i}. ID: {t.id}")
        print(f"   Fecha/Hora: {t.fecha_hora.strftime('%Y-%m-%d %H:%M')}")
        print(f"   Cliente: {t.cliente.nombre_completo}")
        print(f"   Servicio: {t.servicio.nombre}")
        print(f"   Estado: {t.estado}")
        print(f"   Precio: ${t.precio_final}")
        print()
else:
    print("❌ NO HAY TURNOS PARA ESTE EMPLEADO")

# Verificar turnos para hoy
print("\n=== TURNOS PARA HOY (2025-11-13) ===\n")
today = datetime.now().date()
turnos_hoy = Turno.objects.filter(empleado_id=empleado_id, fecha_hora__date=today)
print(f"Turnos hoy: {turnos_hoy.count()}")

# Verificar turnos para el 24 de noviembre
print("\n=== TURNOS PARA 2025-11-24 ===\n")
from datetime import date

fecha_24 = date(2025, 11, 24)
turnos_24 = Turno.objects.filter(empleado_id=empleado_id, fecha_hora__date=fecha_24)
print(f"Turnos el 24: {turnos_24.count()}")
for t in turnos_24:
    print(
        f"  - {t.fecha_hora.strftime('%H:%M')} | {t.cliente.nombre_completo} | {t.estado}"
    )
