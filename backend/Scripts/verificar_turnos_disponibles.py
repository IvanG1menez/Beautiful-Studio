import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "beautiful_studio_backend.settings")
django.setup()

from apps.turnos.models import Turno
from datetime import date

print("=" * 60)
print("TURNOS DE HOY")
print("=" * 60)

today = date.today()
turnos_hoy = Turno.objects.filter(fecha_hora__date=today).order_by("fecha_hora")

if not turnos_hoy.exists():
    print("\n❌ No hay turnos para hoy")
else:
    print(f"\n✅ Se encontraron {turnos_hoy.count()} turno(s)\n")

    for turno in turnos_hoy:
        print(f"ID: {turno.id}")
        print(
            f"Cliente: {turno.cliente.nombre_completo if turno.cliente else 'Sin cliente'}"
        )
        print(
            f"Empleado: {turno.empleado.nombre_completo if turno.empleado else 'Sin empleado'}"
        )
        print(f"Servicio: {turno.servicio.nombre}")
        print(f"Fecha/Hora: {turno.fecha_hora}")
        print(f"Estado: {turno.estado}")
        print(f"Precio: ${turno.precio_final or turno.servicio.precio}")
        print("-" * 40)

# Verificar todos los turnos y sus estados
print("\n" + "=" * 60)
print("TODOS LOS TURNOS EN LA BASE DE DATOS")
print("=" * 60)

todos_turnos = Turno.objects.all().order_by("-fecha_hora")[:10]
print(f"\nÚltimos 10 turnos:\n")

for turno in todos_turnos:
    print(
        f"ID: {turno.id} | Estado: {turno.estado} | Fecha: {turno.fecha_hora.date()} | Cliente: {turno.cliente.nombre_completo if turno.cliente else 'N/A'}"
    )
