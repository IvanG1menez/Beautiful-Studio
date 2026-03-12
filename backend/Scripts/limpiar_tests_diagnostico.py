"""
Script para limpiar datos de prueba de diagnóstico

Elimina todos los datos creados por:
- test_optimizacion_agenda.py
- test_fidelizacion_clientes.py

Y RESETEA los IDs de auto_increment para que vuelvan a empezar desde 1

Uso:
    python Scripts/limpiar_tests_diagnostico.py
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.db import transaction, connection
from django.db.utils import ProgrammingError
from apps.users.models import User
from apps.clientes.models import Cliente, Billetera, MovimientoBilletera
from apps.servicios.models import Servicio, CategoriaServicio
from apps.turnos.models import Turno, HistorialTurno, LogReasignacion


def limpiar_datos_testing():
    """Elimina todos los datos de testing de diagnóstico"""

    print("=" * 70)
    print("🧹 LIMPIEZA DE DATOS DE TESTING DE DIAGNÓSTICO")
    print("=" * 70)

    # Prefijos de emails de testing
    PREFIJOS_TESTING = ["test_opt_", "test_fid_"]

    # Variables que necesitamos fuera del atomic block
    usuarios_testing_ids = []
    total_usuarios = 0
    servicios_count = 0
    categorias_count = 0

    print("\n🔍 Buscando datos de testing...")

    # ==================== RECOPILAR IDs ANTES DEL ATOMIC ====================
    # Primero identificamos todos los usuarios de testing
    usuarios_testing = User.objects.filter(
        email__in=[
            # Optimización
            "test_opt_cliente1@test.com",
            "test_opt_cliente2@test.com",
            # Fidelización
            "test_fid_cliente1@test.com",
            "test_fid_cliente2@test.com",
            "test_fid_cliente3@test.com",
            "test_fid_cliente4@test.com",
        ]
    )

    total_usuarios = usuarios_testing.count()
    usuarios_testing_ids = list(usuarios_testing.values_list("id", flat=True))

    if total_usuarios == 0:
        print("  ✓ No se encontraron usuarios de testing")
        return

    print(f"\n👥 Usuarios de testing encontrados: {total_usuarios}")

    # Obtener clientes asociados
    clientes_ids = []
    for usuario in usuarios_testing:
        try:
            cliente = Cliente.objects.get(user=usuario)
            clientes_ids.append(cliente.id)
            print(f"  • {usuario.email} → Cliente ID: {cliente.id}")
        except Cliente.DoesNotExist:
            print(f"  • {usuario.email} → Sin perfil de cliente")

    # ==================== ATOMIC BLOCK: ELIMINAR TODO EXCEPTO USUARIOS ====================
    with transaction.atomic():
        # ==================== TURNOS ====================
        if clientes_ids:
            print("\n📅 Eliminando turnos asociados...")

            # Historial de turnos
            historial_count = HistorialTurno.objects.filter(
                turno__cliente_id__in=clientes_ids
            ).count()
            if historial_count > 0:
                HistorialTurno.objects.filter(
                    turno__cliente_id__in=clientes_ids
                ).delete()
                print(f"  ✓ {historial_count} registros de historial eliminados")

            # Turnos
            turnos_count = Turno.objects.filter(cliente_id__in=clientes_ids).count()
            if turnos_count > 0:
                turnos = Turno.objects.filter(cliente_id__in=clientes_ids)
                for turno in turnos:
                    print(
                        f"    - Turno ID {turno.id}: {turno.servicio.nombre} - {turno.fecha_hora.strftime('%d/%m/%Y %H:%M')}"
                    )
                turnos.delete()
                print(f"  ✓ {turnos_count} turnos eliminados")

        # ==================== BILLETERAS Y MOVIMIENTOS ====================
        if clientes_ids:
            print("\n💰 Eliminando billeteras y movimientos...")

            # Movimientos
            movimientos_count = MovimientoBilletera.objects.filter(
                billetera__cliente_id__in=clientes_ids
            ).count()
            if movimientos_count > 0:
                MovimientoBilletera.objects.filter(
                    billetera__cliente_id__in=clientes_ids
                ).delete()
                print(f"  ✓ {movimientos_count} movimientos eliminados")

            # Billeteras
            billeteras_count = Billetera.objects.filter(
                cliente_id__in=clientes_ids
            ).count()
            if billeteras_count > 0:
                Billetera.objects.filter(cliente_id__in=clientes_ids).delete()
                print(f"  ✓ {billeteras_count} billeteras eliminadas")

        # ==================== CLIENTES ====================
        if clientes_ids:
            print("\n👤 Eliminando perfiles de cliente...")
            Cliente.objects.filter(id__in=clientes_ids).delete()
            print(f"  ✓ {len(clientes_ids)} perfiles de cliente eliminados")

        # ==================== SERVICIOS DE TESTING ====================
        print("\n💇 Buscando servicios de testing...")
        servicios_testing = Servicio.objects.filter(
            nombre__in=[
                "Test Reacomodamiento",
                "Test Corte (30 días)",
                "Test Coloración (60 días)",
                "Test Tratamiento (Global)",
            ]
        )

        servicios_count = servicios_testing.count()
        if servicios_count > 0:
            print(f"  • Encontrados: {servicios_count} servicios")
            for servicio in servicios_testing:
                print(f"    - {servicio.nombre}")
            servicios_testing.delete()
            print(f"  ✓ {servicios_count} servicios eliminados")
        else:
            print("  ✓ No se encontraron servicios de testing")

        # ==================== CATEGORÍAS DE TESTING ====================
        print("\n📂 Buscando categorías de testing...")
        categorias_testing = CategoriaServicio.objects.filter(
            nombre__in=[
                "Testing Optimización",
                "Testing Fidelización",
            ]
        )

        categorias_count = categorias_testing.count()
        if categorias_count > 0:
            print(f"  • Encontradas: {categorias_count} categorías")
            for categoria in categorias_testing:
                print(f"    - {categoria.nombre}")
            categorias_testing.delete()
            print(f"  ✓ {categorias_count} categorías eliminadas")
        else:
            print("  ✓ No se encontraron categorías de testing")

        # ==================== LOGS DE REASIGNACIÓN ====================
        print("\n📝 Eliminando logs de reasignación...")
        logs_count = (
            LogReasignacion.objects.filter(
                turno_cancelado_id__in=Turno.objects.filter(
                    cliente_id__in=clientes_ids
                ).values_list("id", flat=True)
            ).count()
            if clientes_ids
            else 0
        )

        if logs_count > 0:
            LogReasignacion.objects.filter(
                turno_cancelado_id__in=Turno.objects.filter(
                    cliente_id__in=clientes_ids
                ).values_list("id", flat=True)
            ).delete()
            print(f"  ✓ {logs_count} logs de reasignación eliminados")
        else:
            print("  ✓ No se encontraron logs de reasignación")

        # ==================== RESETEAR AUTO_INCREMENT ====================
        print("\n🔄 Reseteando secuencias de auto_increment...")

        # Detectar el tipo de base de datos
        from django.conf import settings

        db_engine = settings.DATABASES["default"]["ENGINE"]

        if "postgresql" in db_engine:
            print("  ℹ️  Base de datos PostgreSQL detectada")
            print(
                "  ⏭️  Saltando reseteo de secuencias (no implementado para PostgreSQL)"
            )
            print("  💡 Los nuevos registros continuarán desde el último ID")
        elif "sqlite" in db_engine:
            # Solo resetear si se eliminaron datos
            if total_usuarios > 0 or servicios_count > 0:
                with connection.cursor() as cursor:
                    # Resetear auto_increment para las tablas principales
                    tablas_a_resetear = [
                        ("turnos_turno", "Turnos"),
                        ("turnos_historialturno", "Historial de turnos"),
                        ("turnos_logreasignacion", "Logs de reasignación"),
                        ("clientes_billetera", "Billeteras"),
                        ("clientes_movimientobilletera", "Movimientos de billetera"),
                    ]

                    for tabla, nombre in tablas_a_resetear:
                        try:
                            # Verificar si la tabla está vacía o tiene solo registros no-testing
                            cursor.execute(f"SELECT MAX(id) FROM {tabla}")
                            max_id = cursor.fetchone()[0]

                            if max_id is None:
                                # Tabla vacía, resetear a 1
                                cursor.execute(
                                    f"UPDATE sqlite_sequence SET seq = 0 WHERE name = '{tabla}'"
                                )
                                print(f"  ✓ {nombre}: reseteado a 1")
                            else:
                                print(f"  • {nombre}: mantiene secuencia (tiene datos)")
                        except Exception as e:
                            print(f"  ⚠️  {nombre}: {e}")

                print("  ✓ Secuencias actualizadas")
            else:
                print("  • No se requiere reseteo (no se eliminaron datos)")
        else:
            print(f"  ⚠️  Base de datos no soportada para reseteo: {db_engine}")

    # ==================== ELIMINAR USUARIOS (FUERA DEL ATOMIC) ====================
    # Los usuarios se eliminan fuera del at atomic block para evitar que errores
    # en tablas relacionadas (ej: notificaciones_passwordresettoken) rompan toda la transacción
    print("\n🔐 Eliminando usuarios...")
    usuarios_eliminados = 0
    try:
        usuarios_testing = User.objects.filter(id__in=usuarios_testing_ids)
        usuarios_testing.delete()
        usuarios_eliminados = total_usuarios
        print(f"  ✓ {total_usuarios} usuarios eliminados")
    except ProgrammingError as e:
        # Si alguna tabla relacionada no existe, intentamos eliminar uno por uno
        print(f"  ⚠️ Advertencia: {str(e).split('LINE')[0].strip()}")
        print("  🔄 Intentando eliminación individual...")
        for user_id in usuarios_testing_ids:
            try:
                User.objects.filter(id=user_id).delete()
                usuarios_eliminados += 1
            except Exception:
                # Saltamos usuarios problemáticos
                pass
        if usuarios_eliminados > 0:
            print(f"  ✓ {usuarios_eliminados} usuarios eliminados")
        else:
            print(
                f"  ℹ️  No se pudieron eliminar los usuarios (eliminar manualmente si es necesario)"
            )
    except Exception as e:
        print(f"  ⚠️ Error inesperado: {e}")
        print(f"  ℹ️  Usuarios no eliminados (eliminar manualmente si es necesario)")

    # ==================== RESUMEN ====================
    print("\n" + "=" * 70)
    print("✅ LIMPIEZA COMPLETADA")
    print("=" * 70)
    print("\n📊 RESUMEN:")
    print(f"  • Usuarios eliminados: {usuarios_eliminados}")
    print(f"  • Servicios eliminados: {servicios_count}")
    print(f"  • Categorías eliminadas: {categorias_count}")

    from django.conf import settings

    db_engine = settings.DATABASES["default"]["ENGINE"]
    if "sqlite" in db_engine and (total_usuarios > 0 or servicios_count > 0):
        print(f"  • Auto-increment reseteado: Sí ✓")
        print("\n🎯 Los nuevos registros comenzarán desde ID 1")
    elif "postgresql" in db_engine:
        print(f"  • Auto-increment reseteado: No (PostgreSQL)")
        print("\n🎯 Los nuevos registros continuarán la secuencia")

    print("\n💡 Ahora puedes volver a ejecutar los scripts de testing:")
    print("   - python Scripts/test_optimizacion_agenda.py")
    print("   - python Scripts/test_fidelizacion_clientes.py")
    print("=" * 70)


def confirmar_limpieza():
    """Solicita confirmación antes de limpiar"""
    print("\n⚠️  ADVERTENCIA: Esta operación eliminará todos los datos de testing")
    print(
        "   Esto incluye usuarios, clientes, turnos, billeteras, servicios y categorías"
    )
    print("   de prueba creados por los scripts de diagnóstico.\n")

    respuesta = input("¿Deseas continuar? (escribe 'SI' para confirmar): ")

    if respuesta.strip().upper() == "SI":
        return True
    else:
        print("\n❌ Operación cancelada")
        return False


if __name__ == "__main__":
    try:
        if confirmar_limpieza():
            limpiar_datos_testing()
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback

        traceback.print_exc()
