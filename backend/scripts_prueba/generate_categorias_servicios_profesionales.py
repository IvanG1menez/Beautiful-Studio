"""
Genera 5 categorías y 10 servicios por categoría y los asigna
aleatoriamente a los profesionales existentes.
"""

import os
import random
import sys
from decimal import Decimal
from pathlib import Path

import django

# Configurar Django
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.servicios.models import CategoriaServicio, Servicio
from apps.empleados.models import Empleado, EmpleadoServicio

CATEGORIAS_BASE = [
    "Corte",
    "Color",
    "Tratamientos",
    "Peinados",
    "Barbería",
    "Manicura",
    "Pedicura",
    "Depilación",
    "Maquillaje",
    "Spa",
]

SERVICIO_SUFFIX = [
    "Básico",
    "Premium",
    "Express",
    "Intensivo",
    "Deluxe",
    "Hidratación",
    "Reparación",
    "Color",
    "Brillo",
    "Relajante",
    "Completo",
    "Especial",
]


def crear_categorias(cantidad=5):
    print("📁 Creando categorías...")
    categorias_creadas = []

    nombres = random.sample(CATEGORIAS_BASE, k=min(cantidad, len(CATEGORIAS_BASE)))
    for nombre in nombres:
        categoria, created = CategoriaServicio.objects.get_or_create(
            nombre=nombre,
            defaults={
                "descripcion": f"Servicios de {nombre.lower()}.",
                "is_active": True,
            },
        )
        if created:
            print(f"  ✅ Creada: {categoria.nombre}")
        else:
            print(f"  ℹ️  Ya existe: {categoria.nombre}")
        categorias_creadas.append(categoria)

    return categorias_creadas


def crear_servicios(categorias, servicios_por_categoria=10):
    print("\n💅 Creando servicios...")
    servicios_creados = []

    for categoria in categorias:
        for idx in range(servicios_por_categoria):
            sufijo = random.choice(SERVICIO_SUFFIX)
            nombre = f"{categoria.nombre} {sufijo} {idx + 1}"
            descripcion = f"Servicio de {categoria.nombre.lower()} ({sufijo.lower()})."
            precio = Decimal(str(random.randint(800, 12000)))
            duracion = random.choice([30, 45, 60, 75, 90, 120])

            servicio, created = Servicio.objects.get_or_create(
                nombre=nombre,
                categoria=categoria,
                defaults={
                    "descripcion": descripcion,
                    "precio": precio,
                    "duracion_minutos": duracion,
                    "is_active": True,
                },
            )

            if created:
                print(
                    f"  ✅ {categoria.nombre} - {nombre}: ${precio} ({duracion} min)"
                )
            servicios_creados.append(servicio)

    return servicios_creados


def asignar_servicios_a_profesionales(servicios):
    print("\n👥 Asignando servicios a profesionales...")
    profesionales = list(Empleado.objects.all())

    if not profesionales:
        print("❌ No hay profesionales cargados.")
        return

    if not servicios:
        print("❌ No hay servicios para asignar.")
        return

    for profesional in profesionales:
        cantidad = random.randint(3, min(8, len(servicios)))
        seleccion = random.sample(servicios, k=cantidad)

        for servicio in seleccion:
            EmpleadoServicio.objects.get_or_create(
                empleado=profesional,
                servicio=servicio,
                defaults={"nivel_experiencia": random.randint(1, 4)},
            )

        print(
            f"  ✅ {profesional.nombre_completo} -> {len(seleccion)} servicio(s)"
        )


def resumen():
    total_categorias = CategoriaServicio.objects.count()
    total_servicios = Servicio.objects.count()
    total_asignaciones = EmpleadoServicio.objects.count()

    print("\n" + "=" * 70)
    print("✅ GENERACIÓN COMPLETADA")
    print("=" * 70)
    print("📊 Estadísticas:")
    print(f"   • Categorías totales: {total_categorias}")
    print(f"   • Servicios totales: {total_servicios}")
    print(f"   • Asignaciones totales: {total_asignaciones}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("💅 GENERADOR DE CATEGORÍAS, SERVICIOS Y ASIGNACIONES")
    print("=" * 70 + "\n")

    categorias = crear_categorias(cantidad=5)
    servicios = crear_servicios(categorias, servicios_por_categoria=10)
    asignar_servicios_a_profesionales(servicios)
    resumen()
