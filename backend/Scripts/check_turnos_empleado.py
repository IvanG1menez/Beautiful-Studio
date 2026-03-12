import os
import sys
import django

# Agregar el directorio backend al path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.turnos.models import Turno
from apps.empleados.models import Empleado

emp = Empleado.objects.get(id=2)

print("\nTurnos del empleado Carlos Rodriguez (ID=2):")
turnos = Turno.objects.filter(empleado=emp).order_by("fecha_hora")
print(f"Total: {turnos.count()} turnos\n")

for t in turnos[:30]:
    cliente_nombre = t.cliente.nombre_completo if t.cliente else "Sin cliente"
    print(
        f"  - ID {t.id}: {t.fecha_hora} | Estado: {t.estado:15s} | Cliente: {cliente_nombre}"
    )
