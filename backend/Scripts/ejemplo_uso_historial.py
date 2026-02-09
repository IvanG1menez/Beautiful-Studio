"""
Script de ejemplo para demostrar el uso del historial con django-simple-history

Este script puede ser ejecutado con:
python manage.py shell < Scripts/ejemplo_uso_historial.py

O importando las funciones en el shell de Django.
"""

import os
import django

# Configurar Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.contrib.auth import get_user_model
from apps.turnos.models import Turno
from apps.servicios.models import Servicio
from apps.clientes.models import Cliente
from apps.turnos.utils import (
    get_system_history_user,
    restaurar_turno_desde_historial,
)
from simple_history.utils import update_change_reason

User = get_user_model()


def ejemplo_1_ver_historial_turno():
    """Ver el historial completo de un turno"""
    print("\n" + "=" * 50)
    print("EJEMPLO 1: Ver historial de un turno")
    print("=" * 50)

    try:
        turno = Turno.objects.first()
        if not turno:
            print("❌ No hay turnos en la base de datos")
            return

        print(f"\n📅 Turno #{turno.id} - {turno}")
        print(f"\nHistorial de cambios ({turno.history.count()} registros):")
        print("-" * 50)

        for h in turno.history.all():
            tipo = {"+": "➕ CREADO", "~": "✏️  MODIFICADO", "-": "🗑️  ELIMINADO"}.get(
                h.history_type, h.history_type
            )

            usuario = (
                h.history_user.full_name if h.history_user else "Sistema (Automático)"
            )

            print(f"\n{h.history_date.strftime('%d/%m/%Y %H:%M:%S')}")
            print(f"  {tipo}")
            print(f"  👤 Usuario: {usuario}")
            if h.history_change_reason:
                print(f"  📝 Razón: {h.history_change_reason}")
            print(f"  📊 Estado: {h.estado}")

    except Exception as e:
        print(f"❌ Error: {e}")


def ejemplo_2_modificar_con_historia():
    """Modificar un turno registrando el cambio en el historial"""
    print("\n" + "=" * 50)
    print("EJEMPLO 2: Modificar turno con razón del cambio")
    print("=" * 50)

    try:
        turno = Turno.objects.filter(estado="confirmado").first()
        if not turno:
            print("❌ No hay turnos confirmados")
            return

        print(f"\n📅 Modificando turno #{turno.id}")
        print(f"Estado actual: {turno.estado}")

        # Obtener un usuario propietario
        propietario = User.objects.filter(role="propietario").first()
        if not propietario:
            print("❌ No hay usuarios propietarios")
            return

        # Modificar el turno
        turno.notas_empleado = "Cliente llamó para confirmar asistencia"
        turno._history_user = propietario
        update_change_reason(turno, "Confirmación telefónica del cliente")
        turno.save()

        print("✅ Turno modificado")
        print(f"📝 Última modificación: {turno.history.first().history_change_reason}")

    except Exception as e:
        print(f"❌ Error: {e}")


def ejemplo_3_cambio_automatico():
    """Simular un cambio automático realizado por Celery"""
    print("\n" + "=" * 50)
    print("EJEMPLO 3: Cambio automático (Celery/Sistema)")
    print("=" * 50)

    try:
        turno = Turno.objects.filter(estado="confirmado").first()
        if not turno:
            print("❌ No hay turnos confirmados")
            return

        print(f"\n📅 Procesando turno #{turno.id} automáticamente")

        # Obtener usuario de sistema
        system_user = get_system_history_user()
        print(f"👤 Usuario sistema: {system_user.email}")

        # Realizar cambio automático
        turno.estado = "en_proceso"
        turno._history_user = system_user
        update_change_reason(
            turno, "Cambio automático: turno iniciado por proceso programado"
        )
        turno.save()

        print("✅ Estado actualizado automáticamente")
        print(f"📊 Nuevo estado: {turno.estado}")
        print(f"📝 Registro: {turno.history.first().history_change_reason}")

    except Exception as e:
        print(f"❌ Error: {e}")


def ejemplo_4_comparar_versiones():
    """Comparar dos versiones diferentes de un turno"""
    print("\n" + "=" * 50)
    print("EJEMPLO 4: Comparar versiones")
    print("=" * 50)

    try:
        turno = Turno.objects.first()
        if not turno:
            print("❌ No hay turnos en la base de datos")
            return

        historial = turno.history.all()
        if historial.count() < 2:
            print("❌ El turno necesita al menos 2 versiones para comparar")
            return

        version_actual = historial[0]
        version_anterior = historial[1]

        print(f"\n📅 Turno #{turno.id}")
        print("\n📊 Comparación de versiones:")
        print("-" * 50)

        campos = ["estado", "precio_final", "senia_pagada", "notas_empleado"]

        for campo in campos:
            valor_actual = getattr(version_actual, campo)
            valor_anterior = getattr(version_anterior, campo)

            if valor_actual != valor_anterior:
                print(f"\n🔄 {campo.upper()}:")
                print(f"  Anterior: {valor_anterior}")
                print(f"  Actual: {valor_actual}")

    except Exception as e:
        print(f"❌ Error: {e}")


def ejemplo_5_restaurar_version():
    """Restaurar un turno a una versión anterior"""
    print("\n" + "=" * 50)
    print("EJEMPLO 5: Restaurar versión anterior")
    print("=" * 50)

    try:
        turno = Turno.objects.first()
        if not turno:
            print("❌ No hay turnos en la base de datos")
            return

        historial = turno.history.all()
        if historial.count() < 2:
            print("❌ El turno necesita al menos 2 versiones para poder restaurar")
            return

        print(f"\n📅 Turno #{turno.id}")
        print(f"Estado actual: {turno.estado}")

        # Obtener la versión anterior
        version_anterior = historial[1]
        print(f"\nVersión a restaurar:")
        print(f"  📅 Fecha: {version_anterior.history_date}")
        print(f"  📊 Estado: {version_anterior.estado}")

        # Confirmar restauración
        print("\n⚠️  NOTA: Esto restauraría el turno a su versión anterior")
        print("💡 Para ejecutar realmente, descomenta la línea de código")

        # DESCOMENTAR PARA EJECUTAR:
        # propietario = User.objects.filter(role='propietario').first()
        # turno_restaurado = restaurar_turno_desde_historial(
        #     version_anterior.history_id,
        #     propietario
        # )
        # print(f"\n✅ Turno restaurado a estado: {turno_restaurado.estado}")

    except Exception as e:
        print(f"❌ Error: {e}")


def ejemplo_6_estadisticas_historial():
    """Obtener estadísticas del historial"""
    print("\n" + "=" * 50)
    print("EJEMPLO 6: Estadísticas del historial")
    print("=" * 50)

    try:
        print("\n📊 ESTADÍSTICAS GENERALES:")
        print("-" * 50)

        # Turnos
        total_cambios_turnos = Turno.history.count()
        turnos_creados = Turno.history.filter(history_type="+").count()
        turnos_modificados = Turno.history.filter(history_type="~").count()
        turnos_eliminados = Turno.history.filter(history_type="-").count()

        print(f"\n🎫 TURNOS:")
        print(f"  Total de cambios: {total_cambios_turnos}")
        print(f"  ➕ Creados: {turnos_creados}")
        print(f"  ✏️  Modificados: {turnos_modificados}")
        print(f"  🗑️  Eliminados: {turnos_eliminados}")

        # Servicios
        total_cambios_servicios = Servicio.history.count()
        servicios_creados = Servicio.history.filter(history_type="+").count()
        servicios_modificados = Servicio.history.filter(history_type="~").count()

        print(f"\n✂️  SERVICIOS:")
        print(f"  Total de cambios: {total_cambios_servicios}")
        print(f"  ➕ Creados: {servicios_creados}")
        print(f"  ✏️  Modificados: {servicios_modificados}")

        # Clientes
        total_cambios_clientes = Cliente.history.count()
        clientes_creados = Cliente.history.filter(history_type="+").count()
        clientes_modificados = Cliente.history.filter(history_type="~").count()

        print(f"\n👥 CLIENTES:")
        print(f"  Total de cambios: {total_cambios_clientes}")
        print(f"  ➕ Creados: {clientes_creados}")
        print(f"  ✏️  Modificados: {clientes_modificados}")

        # Cambios por usuario
        print(f"\n👤 TOP 5 USUARIOS CON MÁS CAMBIOS:")
        print("-" * 50)

        from django.db.models import Count

        usuarios = (
            Turno.history.values("history_user__email", "history_user__full_name")
            .annotate(total=Count("history_id"))
            .order_by("-total")[:5]
        )

        for i, u in enumerate(usuarios, 1):
            email = u["history_user__email"] or "Sistema"
            nombre = u["history_user__full_name"] or "Sistema Automático"
            total = u["total"]
            print(f"  {i}. {nombre} ({email}): {total} cambios")

    except Exception as e:
        print(f"❌ Error: {e}")


def ejecutar_todos_los_ejemplos():
    """Ejecuta todos los ejemplos en secuencia"""
    print("\n" + "=" * 50)
    print("🎯 EJEMPLOS DE USO DEL HISTORIAL")
    print("django-simple-history")
    print("=" * 50)

    ejemplo_1_ver_historial_turno()
    ejemplo_2_modificar_con_historia()
    ejemplo_3_cambio_automatico()
    ejemplo_4_comparar_versiones()
    ejemplo_5_restaurar_version()
    ejemplo_6_estadisticas_historial()

    print("\n" + "=" * 50)
    print("✅ Todos los ejemplos ejecutados")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    # Ejecutar todos los ejemplos
    ejecutar_todos_los_ejemplos()

    # O ejecutar ejemplos individuales:
    # ejemplo_1_ver_historial_turno()
    # ejemplo_2_modificar_con_historia()
    # ejemplo_3_cambio_automatico()
    # ejemplo_4_comparar_versiones()
    # ejemplo_5_restaurar_version()
    # ejemplo_6_estadisticas_historial()
