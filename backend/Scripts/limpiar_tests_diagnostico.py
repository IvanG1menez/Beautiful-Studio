"""
Script para limpiar datos de prueba de diagnóstico

Elimina todos los datos creados por:
- test_optimizacion_agenda.py
- test_fidelizacion_clientes.py

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

from django.db import transaction
from apps.users.models import User
from apps.clientes.models import Cliente, Billetera, MovimientoBilletera
from apps.servicios.models import Servicio, CategoriaServicio
from apps.turnos.models import Turno, HistorialTurno


def limpiar_datos_testing():
    """Elimina todos los datos de testing de diagnóstico"""

    print("=" * 70)
    print("🧹 LIMPIEZA DE DATOS DE TESTING DE DIAGNÓSTICO")
    print("=" * 70)

    # Prefijos de emails de testing
    PREFIJOS_TESTING = ["test_opt_", "test_fid_"]

    with transaction.atomic():
        print("\n🔍 Buscando datos de testing...")

        # ==================== USUARIOS/CLIENTES DE TESTING ====================
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

        if total_usuarios == 0:
            print("  ✓ No se encontraron usuarios de testing")
        else:
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

            # ==================== USUARIOS ====================
            print("\n🔐 Eliminando usuarios...")
            usuarios_testing.delete()
            print(f"  ✓ {total_usuarios} usuarios eliminados")

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

        # ==================== RESUMEN ====================
        print("\n" + "=" * 70)
        print("✅ LIMPIEZA COMPLETADA")
        print("=" * 70)
        print("\n📊 RESUMEN:")
        print(f"  • Usuarios eliminados: {total_usuarios}")
        print(f"  • Servicios eliminados: {servicios_count}")
        print(f"  • Categorías eliminadas: {categorias_count}")
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
