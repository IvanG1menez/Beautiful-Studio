"""
Script para generar turnos de prueba con datos realistas
"""

import os
import django
import random
from datetime import datetime, timedelta

# Configurar Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.utils import timezone
from apps.turnos.models import Turno
from apps.clientes.models import Cliente
from apps.empleados.models import Empleado
from apps.servicios.models import Servicio
from decimal import Decimal

NOTAS_CLIENTE = [
    "Primera vez en el salón",
    "Quiero un cambio de look",
    "Tengo una fiesta el fin de semana",
    "Prefiero colores naturales",
    "Me gustan los estilos modernos",
    "Soy alérgico a ciertos productos",
    "Quiero mantener mi estilo actual",
    "",  # Sin notas
]


def generar_turnos(cantidad=50):
    """Genera turnos de prueba"""
    print(f"🚀 Iniciando generación de {cantidad} turnos...")

    # Obtener datos necesarios
    clientes = list(Cliente.objects.all())
    empleados = list(Empleado.objects.filter(is_disponible=True))
    servicios = list(Servicio.objects.filter(is_active=True))

    if not clientes:
        print(
            "❌ No hay clientes en la base de datos. Ejecuta generate_clientes.py primero."
        )
        return

    if not empleados:
        print("❌ No hay empleados disponibles. Ejecuta generate_empleados.py primero.")
        return

    if not servicios:
        print("❌ No hay servicios activos. Ejecuta generate_servicios.py primero.")
        return

    print(f"📊 Datos disponibles:")
    print(f"   • Clientes: {len(clientes)}")
    print(f"   • Empleados: {len(empleados)}")
    print(f"   • Servicios: {len(servicios)}")
    print()

    turnos_creados = 0
    turnos_fallidos = 0

    # Generar turnos para los próximos 30 días
    fecha_inicio = timezone.now()
    fecha_fin = fecha_inicio + timedelta(days=30)

    for i in range(cantidad):
        try:
            # Seleccionar aleatoriamente
            cliente = random.choice(clientes)
            empleado = random.choice(empleados)
            servicio = random.choice(servicios)

            # Generar fecha y hora aleatorias
            dias_adelante = random.randint(0, 30)
            fecha_base = fecha_inicio + timedelta(days=dias_adelante)

            # Horario entre 9:00 y 19:00
            hora = random.randint(9, 18)
            minuto = random.choice([0, 30])

            fecha_hora = fecha_base.replace(
                hour=hora, minute=minuto, second=0, microsecond=0
            )

            # Verificar si el empleado ya tiene un turno en ese horario
            hora_fin = fecha_hora + timedelta(minutes=servicio.duracion_minutos)
            conflicto = Turno.objects.filter(
                empleado=empleado,
                fecha_hora__lt=hora_fin,
                estado__in=["pendiente", "confirmado", "en_proceso"],
            ).exists()

            if conflicto:
                # Intentar con otro horario
                fecha_hora = fecha_hora + timedelta(hours=1)

            # Estado aleatorio con distribución realista
            estado_opciones = [
                ("pendiente", 40),
                ("confirmado", 30),
                ("en_proceso", 5),
                ("completado", 15),
                ("cancelado", 8),
                ("no_asistio", 2),
            ]

            # Si es en el futuro, no puede estar completado
            if fecha_hora > timezone.now():
                estado_opciones = [
                    ("pendiente", 60),
                    ("confirmado", 40),
                ]

            estados = []
            pesos = []
            for estado, peso in estado_opciones:
                estados.append(estado)
                pesos.append(peso)

            estado = random.choices(estados, weights=pesos)[0]

            # Precio final con posible descuento
            precio_base = servicio.precio
            descuento = random.choice([0, 0, 0, 10, 15, 20])  # 50% sin descuento
            precio_final = precio_base * (1 - Decimal(descuento) / 100)

            # Notas
            notas_cliente = random.choice(NOTAS_CLIENTE)
            notas_empleado = (
                "Servicio realizado correctamente" if estado == "completado" else ""
            )

            # Crear turno
            turno = Turno.objects.create(
                cliente=cliente,
                empleado=empleado,
                servicio=servicio,
                fecha_hora=fecha_hora,
                estado=estado,
                notas_cliente=notas_cliente,
                notas_empleado=notas_empleado,
                precio_final=precio_final,
            )

            turnos_creados += 1

            if (i + 1) % 10 == 0:
                print(f"✅ Creados {turnos_creados} turnos...")

        except Exception as e:
            turnos_fallidos += 1
            print(f"❌ Error creando turno {i+1}: {str(e)}")

    print(f"\n{'='*70}")
    print(f"✅ Proceso completado!")
    print(f"{'='*70}")
    print(f"📊 Turnos creados: {turnos_creados}")
    print(f"❌ Turnos fallidos: {turnos_fallidos}")
    print(f"📅 Total turnos en base de datos: {Turno.objects.count()}")
    print(f"{'='*70}\n")

    # Estadísticas por estado
    print("📊 Distribución por estado:")
    for estado, nombre in Turno.ESTADO_CHOICES:
        cantidad = Turno.objects.filter(estado=estado).count()
        print(f"   • {nombre}: {cantidad} turno(s)")

    print()

    # Mostrar algunos ejemplos
    if turnos_creados > 0:
        print("📋 Ejemplos de turnos creados:")
        ejemplos = Turno.objects.select_related(
            "cliente__user", "empleado__user", "servicio__categoria"
        ).order_by("?")[:5]

        for turno in ejemplos:
            print(f"\n   • {turno.cliente.nombre_completo}")
            print(
                f"     Servicio: {turno.servicio.categoria.nombre} - {turno.servicio.nombre}"
            )
            print(f"     Profesional: {turno.empleado.nombre_completo}")
            print(f"     Fecha: {turno.fecha_hora.strftime('%d/%m/%Y %H:%M')}")
            print(f"     Estado: {turno.get_estado_display()}")
            print(f"     Precio: ${turno.precio_final}")


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("📅 GENERADOR DE TURNOS - BEAUTIFUL STUDIO")
    print("=" * 70 + "\n")

    generar_turnos(50)
