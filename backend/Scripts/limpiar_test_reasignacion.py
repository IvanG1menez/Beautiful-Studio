import os
import sys
import django

# Agregar el directorio backend al path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.turnos.models import Turno, LogReasignacion
from django.db.models import Q
import argparse


def limpiar_test_reasignacion(force=False):
    """
    Limpia los datos de prueba del test de reasignación:
    - Turnos con notas "Turno de prueba - Cliente A/B"
    - LogReasignacion asociados

    Args:
        force: Si es True, no pide confirmación
    """
    print("=" * 70)
    print("🧹 LIMPIEZA DE DATOS DE PRUEBA - REASIGNACIÓN")
    print("=" * 70)
    print()

    # 1. Buscar turnos de prueba
    turnos_prueba = Turno.objects.filter(
        Q(notas_cliente__icontains="Turno de prueba - Cliente A")
        | Q(notas_cliente__icontains="Turno de prueba - Cliente B")
    )

    if not turnos_prueba.exists():
        print("✅ No se encontraron turnos de prueba para eliminar")
        print()
        return

    print(f"📋 Se encontraron {turnos_prueba.count()} turnos de prueba:")
    for turno in turnos_prueba:
        cliente_nombre = (
            turno.cliente.nombre_completo if turno.cliente else "Sin cliente"
        )
        print(
            f"   - ID {turno.id}: {cliente_nombre} | {turno.fecha_hora} | Estado: {turno.estado}"
        )

    print()

    # 2. Obtener IDs de los turnos
    turno_ids = list(turnos_prueba.values_list("id", flat=True))

    # 3. Buscar LogReasignacion asociados
    logs = LogReasignacion.objects.filter(
        Q(turno_cancelado_id__in=turno_ids) | Q(turno_ofrecido_id__in=turno_ids)
    )

    if logs.exists():
        print(f"📝 Se encontraron {logs.count()} registros LogReasignacion asociados:")
        for log in logs:
            print(
                f"   - Log ID {log.id}: Token {log.token} | Estado: {log.estado_final or 'pendiente'}"
            )
        print()

    # 4. Confirmación
    if not force:
        print("⚠️  ¿Confirmas que quieres eliminar estos registros? (y/n): ", end="")
        try:
            confirmacion = input().strip().lower()
        except (EOFError, KeyboardInterrupt):
            print()
            print("❌ Operación cancelada")
            print()
            return

        if confirmacion != "y":
            print()
            print("❌ Operación cancelada")
            print()
            return
    else:
        print("🔄 Modo automático activado (--force), eliminando sin confirmación...")

    print()
    print("🗑️  Eliminando registros...")

    # 5. Eliminar en orden correcto
    logs_count = logs.count()
    logs.delete()
    print(f"   ✅ {logs_count} LogReasignacion eliminados")

    turnos_count = turnos_prueba.count()
    turnos_prueba.delete()
    print(f"   ✅ {turnos_count} Turnos eliminados")

    print()
    print("=" * 70)
    print("✅ Limpieza completada exitosamente")
    print("=" * 70)
    print()
    print("💡 Ya puedes ejecutar el test nuevamente:")
    print("   .\\venv\\Scripts\\python Scripts\\test_reasignacion_manual.py")
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Limpia los datos de prueba del test de reasignación"
    )
    parser.add_argument(
        "--force", action="store_true", help="Elimina sin pedir confirmación"
    )
    args = parser.parse_args()

    try:
        limpiar_test_reasignacion(force=args.force)
    except Exception as e:
        print()
        print(f"❌ ERROR: {e}")
        import traceback

        traceback.print_exc()
        print()
