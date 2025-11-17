"""
Script para generar categorías y servicios de salón de belleza
"""

import os
import django
import random

# Configurar Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "beautiful_studio_backend.settings")
django.setup()

from apps.servicios.models import CategoriaServicio, Servicio
from decimal import Decimal

# Categorías de servicios
CATEGORIAS = [
    {
        "nombre": "Corte de Cabello",
        "descripcion": "Cortes de cabello para damas, caballeros y niños. Incluye lavado y secado.",
    },
    {
        "nombre": "Coloración",
        "descripcion": "Servicios de coloración, tintes, mechas y balayage profesional.",
    },
    {
        "nombre": "Tratamientos Capilares",
        "descripcion": "Tratamientos de hidratación, reparación y fortalecimiento del cabello.",
    },
    {
        "nombre": "Peinados",
        "descripcion": "Peinados para eventos especiales, bodas y ocasiones formales.",
    },
    {
        "nombre": "Barbería",
        "descripcion": "Servicios especializados de barbería para caballeros.",
    },
    {
        "nombre": "Manicura y Pedicura",
        "descripcion": "Cuidado profesional de manos y pies, incluyendo esmaltado.",
    },
    {
        "nombre": "Uñas Esculpidas",
        "descripcion": "Diseño y aplicación de uñas acrílicas, gel y decoraciones.",
    },
    {
        "nombre": "Depilación",
        "descripcion": "Servicios de depilación con cera para rostro y cuerpo.",
    },
    {
        "nombre": "Maquillaje",
        "descripcion": "Maquillaje profesional para eventos, novias y sesiones fotográficas.",
    },
    {
        "nombre": "Tratamientos Faciales",
        "descripcion": "Limpieza facial, hidratación y tratamientos anti-edad.",
    },
    {
        "nombre": "Cejas y Pestañas",
        "descripcion": "Diseño de cejas, tinte y extensiones de pestañas.",
    },
    {
        "nombre": "Alisado y Permanente",
        "descripcion": "Alisado brasileño, japonés y permanente para el cabello.",
    },
    {
        "nombre": "Spa Capilar",
        "descripcion": "Experiencias de spa con masajes capilares y tratamientos relajantes.",
    },
    {
        "nombre": "Extensiones",
        "descripcion": "Aplicación de extensiones de cabello natural y sintético.",
    },
    {
        "nombre": "Masajes",
        "descripcion": "Masajes relajantes, reductivos y terapéuticos.",
    },
]

# Servicios por categoría
SERVICIOS_DATA = {
    "Corte de Cabello": [
        ("Corte Dama", "Corte de cabello para dama, incluye lavado y secado", 2500, 45),
        (
            "Corte Caballero",
            "Corte de cabello para caballero, incluye lavado",
            1500,
            30,
        ),
        ("Corte Niño/a", "Corte de cabello para niños hasta 12 años", 1200, 30),
    ],
    "Coloración": [
        ("Tinte Completo", "Aplicación de tinte en todo el cabello", 3500, 90),
        ("Mechas Tradicionales", "Mechas con gorro o papel aluminio", 4000, 120),
        ("Balayage", "Técnica de coloración gradual y natural", 5500, 150),
        ("Ombré", "Degradado de color de raíz a puntas", 5000, 140),
    ],
    "Tratamientos Capilares": [
        ("Hidratación Profunda", "Tratamiento de hidratación intensiva", 2800, 60),
        ("Botox Capilar", "Tratamiento de reparación y brillo", 4500, 90),
        ("Keratina", "Tratamiento reconstructor con keratina", 3500, 75),
    ],
    "Peinados": [
        ("Peinado Social", "Peinado para eventos y fiestas", 3000, 60),
        ("Peinado de Novia", "Peinado especial para novias, incluye prueba", 8000, 120),
        ("Recogido Elegante", "Recogido para ocasiones especiales", 3500, 75),
    ],
    "Barbería": [
        ("Corte y Barba", "Corte de cabello y arreglo de barba", 2000, 45),
        ("Afeitado Tradicional", "Afeitado con navaja y toallas calientes", 1500, 30),
        ("Diseño de Barba", "Diseño y perfilado de barba", 1200, 25),
    ],
    "Manicura y Pedicura": [
        ("Manicura Clásica", "Limpieza, limado y esmaltado de uñas", 1200, 45),
        ("Pedicura Spa", "Pedicura completa con exfoliación y masaje", 1800, 60),
        ("Manicura Francesa", "Manicura con diseño francés tradicional", 1500, 50),
    ],
    "Uñas Esculpidas": [
        ("Uñas Acrílicas", "Aplicación de uñas acrílicas completas", 3500, 120),
        ("Uñas de Gel", "Aplicación de uñas de gel", 4000, 90),
        ("Diseño en Uñas", "Decoración artística en uñas", 1500, 30),
    ],
    "Depilación": [
        ("Depilación Facial", "Depilación de rostro completo", 800, 20),
        ("Depilación Piernas Completas", "Depilación de piernas enteras", 2500, 45),
        ("Depilación Brasileña", "Depilación de zona íntima completa", 2000, 40),
    ],
    "Maquillaje": [
        ("Maquillaje Social", "Maquillaje para eventos y fiestas", 2500, 60),
        ("Maquillaje de Novia", "Maquillaje especial para novias", 5000, 90),
    ],
    "Tratamientos Faciales": [
        ("Limpieza Facial Profunda", "Limpieza con extracción y mascarilla", 2800, 60),
        ("Hidratación Facial", "Tratamiento hidratante para rostro", 3200, 75),
    ],
    "Cejas y Pestañas": [
        ("Diseño de Cejas", "Depilación y diseño de cejas", 600, 20),
        ("Tinte de Cejas", "Coloración de cejas", 800, 25),
        ("Extensiones de Pestañas", "Aplicación de extensiones pelo a pelo", 4500, 120),
    ],
    "Alisado y Permanente": [
        ("Alisado Brasileño", "Alisado permanente con keratina", 8000, 180),
        ("Alisado Japonés", "Alisado definitivo y permanente", 12000, 240),
    ],
    "Spa Capilar": [
        ("Spa Capilar Relajante", "Tratamiento con masajes y aromaterapia", 4000, 90),
    ],
    "Extensiones": [
        ("Extensiones de Cabello", "Aplicación de extensiones naturales", 15000, 180),
    ],
    "Masajes": [
        ("Masaje Relajante", "Masaje corporal relajante", 3500, 60),
    ],
}


def crear_categorias():
    """Crear las categorías de servicios"""
    print("📁 Creando categorías...")
    categorias_creadas = []

    for cat_data in CATEGORIAS:
        categoria, created = CategoriaServicio.objects.get_or_create(
            nombre=cat_data["nombre"],
            defaults={"descripcion": cat_data["descripcion"], "is_active": True},
        )

        if created:
            print(f"  ✅ Creada: {categoria.nombre}")
        else:
            print(f"  ℹ️  Ya existe: {categoria.nombre}")

        categorias_creadas.append(categoria)

    return categorias_creadas


def crear_servicios():
    """Crear los servicios para cada categoría"""
    print("\n💅 Creando servicios...")

    servicios_creados = 0
    servicios_existentes = 0

    for nombre_categoria, servicios in SERVICIOS_DATA.items():
        try:
            categoria = CategoriaServicio.objects.get(nombre=nombre_categoria)

            for nombre, descripcion, precio, duracion in servicios:
                servicio, created = Servicio.objects.get_or_create(
                    nombre=nombre,
                    categoria=categoria,
                    defaults={
                        "descripcion": descripcion,
                        "precio": Decimal(str(precio)),
                        "duracion_minutos": duracion,
                        "is_active": True,
                    },
                )

                if created:
                    print(
                        f"  ✅ {categoria.nombre} - {nombre}: ${precio} ({duracion} min)"
                    )
                    servicios_creados += 1
                else:
                    servicios_existentes += 1

        except CategoriaServicio.DoesNotExist:
            print(f"  ❌ No se encontró la categoría: {nombre_categoria}")

    return servicios_creados, servicios_existentes


def generar_estadisticas():
    """Mostrar estadísticas finales"""
    total_categorias = CategoriaServicio.objects.count()
    total_servicios = Servicio.objects.count()

    print(f"\n{'='*70}")
    print(f"✅ GENERACIÓN COMPLETADA")
    print(f"{'='*70}")
    print(f"📊 Estadísticas:")
    print(f"   • Categorías totales: {total_categorias}")
    print(f"   • Servicios totales: {total_servicios}")
    print(f"{'='*70}\n")

    # Mostrar servicios por categoría
    print("📋 Servicios por categoría:")
    for categoria in CategoriaServicio.objects.all():
        cantidad = categoria.servicios.count()
        print(f"   • {categoria.nombre}: {cantidad} servicio(s)")

    print(f"\n{'='*70}")

    # Mostrar algunos servicios de ejemplo
    print("\n💎 Ejemplos de servicios creados:")
    servicios_ejemplo = Servicio.objects.select_related("categoria").order_by("?")[:5]
    for servicio in servicios_ejemplo:
        print(f"   • {servicio.categoria.nombre} - {servicio.nombre}")
        print(f"     Precio: ${servicio.precio} | Duración: {servicio.duracion_horas}")
        if servicio.descripcion:
            print(f"     {servicio.descripcion}")
        print()


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("💅 GENERADOR DE SERVICIOS - BEAUTIFUL STUDIO")
    print("=" * 70 + "\n")

    try:
        # Crear categorías
        categorias = crear_categorias()

        # Crear servicios
        creados, existentes = crear_servicios()

        # Mostrar estadísticas
        generar_estadisticas()

        if existentes > 0:
            print(
                f"\nℹ️  Nota: {existentes} servicio(s) ya existían en la base de datos.\n"
            )

    except Exception as e:
        print(f"\n❌ Error durante la generación: {str(e)}\n")
        import traceback

        traceback.print_exc()
