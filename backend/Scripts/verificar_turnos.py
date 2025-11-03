import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "beautiful_studio_backend.settings")
django.setup()

from apps.turnos.models import Turno

turnos = Turno.objects.all()
print(f"\n📅 Total turnos: {turnos.count()}\n")

for t in turnos:
    print(f"Turno ID {t.id}:")
    print(f"  📆 Fecha: {t.fecha_hora}")
    print(f"  👤 Cliente: {t.cliente.nombre_completo if t.cliente else 'SIN CLIENTE'}")
    print(
        f"  💼 Empleado: {t.empleado.nombre_completo if t.empleado else 'SIN EMPLEADO'}"
    )
    print(f"  ✂️ Servicio: {t.servicio.nombre}")
    print(f"  📊 Estado: {t.estado}")
    print(f"  💰 Precio: ${t.precio_final}")
    print()
