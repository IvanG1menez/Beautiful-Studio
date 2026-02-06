"""
Asigna un único servicio aleatorio a cada profesional.
"""

import os
import random
import sys
from pathlib import Path

import django

# Configurar Django
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.empleados.models import Empleado, EmpleadoServicio
from apps.servicios.models import Servicio


def asignar_un_servicio():
    print("🧩 Asignando un solo servicio por profesional...")

    profesionales = list(Empleado.objects.all())
    servicios = list(Servicio.objects.filter(is_active=True))

    if not profesionales:
        print("❌ No hay profesionales.")
        return
    if not servicios:
        print("❌ No hay servicios activos.")
        return

    for profesional in profesionales:
        EmpleadoServicio.objects.filter(empleado=profesional).delete()
        servicio = random.choice(servicios)
        EmpleadoServicio.objects.create(
            empleado=profesional,
            servicio=servicio,
            nivel_experiencia=random.randint(1, 4),
        )
        print(f"  ✅ {profesional.nombre_completo} -> {servicio.nombre}")


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("🧩 ASIGNADOR DE UN SERVICIO POR PROFESIONAL")
    print("=" * 70 + "\n")

    asignar_un_servicio()
