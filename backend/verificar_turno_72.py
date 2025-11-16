#!/usr/bin/env python
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "beautiful_studio_backend.settings")
django.setup()

from apps.turnos.models import Turno

print("\n=== Verificando turno ID 72 ===")

turno = Turno.objects.filter(id=72).first()

if turno:
    print(f"✅ Turno 72 existe")
    print(f"   Cliente: {turno.cliente.nombre_completo} (ID: {turno.cliente.id})")
    print(
        f"   Empleado: {turno.empleado.user.get_full_name()} (ID: {turno.empleado.id})"
    )
    print(f"   Fecha/Hora: {turno.fecha_hora}")
    print(f"   Estado: {turno.estado}")
    print(f"   Servicio: {turno.servicio.nombre}")
else:
    print("❌ El turno 72 NO existe en la base de datos")

print("\n=== Turnos del empleado 71 para 17/11/2025 ===")
from datetime import date

fecha = date(2025, 11, 17)
turnos_fecha = Turno.objects.filter(empleado_id=71, fecha_hora__date=fecha)

print(f"Total turnos: {turnos_fecha.count()}")
for t in turnos_fecha:
    print(
        f"  Turno ID: {t.id} | {t.fecha_hora.strftime('%H:%M')} | {t.cliente.nombre_completo} | {t.estado}"
    )
