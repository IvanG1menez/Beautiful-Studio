"""
Script para relacionar empleados con servicios según sus especialidades
"""

import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "beautiful_studio_backend.settings")
django.setup()

from apps.empleados.models import Empleado, EmpleadoServicio
from apps.servicios.models import Servicio, CategoriaServicio
import random


def relacionar_empleados_servicios():
    """Relaciona empleados con servicios según sus especialidades"""

    # Mapeo de especialidades a categorías de servicios
    especialidad_a_categorias = {
        "corte": ["Corte de Cabello", "Corte de cabello", "Barbería", "Peinados"],
        "color": ["Coloración"],
        "tratamientos": [
            "Tratamientos Capilares",
            "Alisado y Permanente",
            "Spa Capilar",
        ],
        "unas": ["Manicura y Pedicura", "Uñas Esculpidas"],
        "maquillaje": ["Maquillaje", "Cejas y Pestañas"],
        "general": [
            "Corte de Cabello",
            "Corte de cabello",
            "Coloración",
            "Tratamientos Capilares",
            "Peinados",
            "Manicura y Pedicura",
        ],
    }

    empleados = Empleado.objects.all()
    categorias = {cat.nombre: cat for cat in CategoriaServicio.objects.all()}

    print(f"\n📋 Iniciando relación de empleados con servicios...")
    print(f"   • {empleados.count()} empleados encontrados")
    print(f"   • {len(categorias)} categorías encontradas")

    relaciones_creadas = 0
    empleados_sin_servicios = 0

    for empleado in empleados:
        especialidad = empleado.especialidades
        categorias_relacionadas = especialidad_a_categorias.get(especialidad, [])

        if not categorias_relacionadas:
            print(
                f"⚠️  Empleado {empleado.nombre_completo} sin categorías relacionadas (especialidad: {especialidad})"
            )
            empleados_sin_servicios += 1
            continue

        # Obtener servicios de las categorías relacionadas
        servicios_disponibles = []
        for cat_nombre in categorias_relacionadas:
            if cat_nombre in categorias:
                cat = categorias[cat_nombre]
                servicios_cat = Servicio.objects.filter(categoria=cat, is_active=True)
                servicios_disponibles.extend(servicios_cat)

        if not servicios_disponibles:
            print(
                f"⚠️  No se encontraron servicios activos para {empleado.nombre_completo}"
            )
            empleados_sin_servicios += 1
            continue

        # Asignar servicios al empleado
        servicios_asignados = 0
        for servicio in servicios_disponibles:
            # Verificar si ya existe la relación
            if not EmpleadoServicio.objects.filter(
                empleado=empleado, servicio=servicio
            ).exists():
                # Determinar nivel de experiencia (aleatorio pero ponderado)
                nivel = random.choices(
                    [2, 3, 4],  # Intermedio, Avanzado, Experto
                    weights=[0.3, 0.5, 0.2],  # Mayoría avanzado
                )[0]

                EmpleadoServicio.objects.create(
                    empleado=empleado, servicio=servicio, nivel_experiencia=nivel
                )
                servicios_asignados += 1
                relaciones_creadas += 1

        especialidad_display = empleado.get_especialidades_display()
        print(
            f"✅ {empleado.nombre_completo} ({especialidad_display}): {servicios_asignados} servicios asignados"
        )

    print(f"\n✨ Proceso completado:")
    print(f"   • {relaciones_creadas} relaciones creadas")
    print(f"   • {empleados_sin_servicios} empleados sin servicios asignados")

    # Mostrar resumen por especialidad
    print(f"\n📊 Resumen por especialidad:")
    for especialidad, _ in Empleado.ESPECIALIDAD_CHOICES:
        count = Empleado.objects.filter(especialidades=especialidad).count()
        relaciones = EmpleadoServicio.objects.filter(
            empleado__especialidades=especialidad
        ).count()
        if count > 0:
            promedio = relaciones / count
            print(
                f"   • {especialidad.capitalize()}: {count} empleados, {relaciones} relaciones (promedio: {promedio:.1f} servicios/empleado)"
            )


if __name__ == "__main__":
    print("=" * 80)
    print("RELACIONAR EMPLEADOS CON SERVICIOS")
    print("=" * 80)

    relacionar_empleados_servicios()

    print("\n" + "=" * 80)
    print("¡Listo! Los empleados han sido relacionados con los servicios.")
    print("=" * 80)
