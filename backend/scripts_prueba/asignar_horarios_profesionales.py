"""
Asigna días y horarios aleatorios (incluyendo horarios divididos) a cada profesional.
"""

import os
import random
import sys
from datetime import time
from pathlib import Path

import django

# Configurar Django
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.empleados.models import Empleado, HorarioEmpleado

DIAS_MAP = {
    0: "L",
    1: "M",
    2: "X",
    3: "J",
    4: "V",
    5: "S",
    6: "D",
}


def random_time(hour):
    return time(hour=hour, minute=0)


def generar_rangos_para_dia(dividido: bool):
    rangos = []

    if dividido:
        morning_start = random.choice([8, 9, 10])
        morning_end = morning_start + random.choice([3, 4])
        afternoon_start = random.choice([14, 15, 16])
        afternoon_end = min(20, afternoon_start + random.choice([2, 3, 4]))

        rangos.append((random_time(morning_start), random_time(morning_end)))
        rangos.append((random_time(afternoon_start), random_time(afternoon_end)))
    else:
        start = random.choice([8, 9, 10, 11])
        end = min(20, start + random.choice([4, 5, 6, 7]))
        rangos.append((random_time(start), random_time(end)))

    return rangos


def asignar_horarios():
    print("🗓️  Asignando días y horarios aleatorios...")

    profesionales = list(Empleado.objects.all())
    if not profesionales:
        print("❌ No hay profesionales para asignar horarios.")
        return

    for profesional in profesionales:
        HorarioEmpleado.objects.filter(empleado=profesional).delete()

        dias = random.sample(range(0, 7), k=random.randint(3, 6))
        dias.sort()

        rangos_creados = []
        for dia in dias:
            dividido = random.random() < 0.35
            rangos = generar_rangos_para_dia(dividido)

            for hora_inicio, hora_fin in rangos:
                HorarioEmpleado.objects.create(
                    empleado=profesional,
                    dia_semana=dia,
                    hora_inicio=hora_inicio,
                    hora_fin=hora_fin,
                    is_active=True,
                )
                rangos_creados.append((dia, hora_inicio, hora_fin))

        # Actualizar resumen en el perfil
        horario_entrada = min(r[1] for r in rangos_creados)
        horario_salida = max(r[2] for r in rangos_creados)
        dias_trabajo = ",".join(DIAS_MAP[d] for d in dias)

        profesional.horario_entrada = horario_entrada
        profesional.horario_salida = horario_salida
        profesional.dias_trabajo = dias_trabajo
        profesional.is_disponible = True
        profesional.save(update_fields=[
            "horario_entrada",
            "horario_salida",
            "dias_trabajo",
            "is_disponible",
        ])

        print(
            f"  ✅ {profesional.nombre_completo} -> días {dias_trabajo} ({len(rangos_creados)} rango(s))"
        )


def resumen():
    total_horarios = HorarioEmpleado.objects.count()
    print("\n" + "=" * 70)
    print("✅ ASIGNACIÓN COMPLETADA")
    print("=" * 70)
    print(f"📊 Horarios totales: {total_horarios}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("🗓️  ASIGNADOR DE HORARIOS PARA PROFESIONALES")
    print("=" * 70 + "\n")

    asignar_horarios()
    resumen()
