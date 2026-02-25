import os
import sys
import django

# Agregar el directorio backend al path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.turnos.models import Turno
from apps.clientes.models import Billetera


def limpiar_turnos():
    """
    Elimina todos los turnos de la base de datos y restablece las billeteras.
    """
    print("🔄 Limpiando turnos y restableciendo billeteras...\n")

    # Eliminar todos los turnos
    count_turnos = Turno.objects.all().count()
    Turno.objects.all().delete()
    print(f"  ✓ {count_turnos} turnos eliminados")

    # Restablecer saldo de billeteras a 1000
    billeteras = Billetera.objects.all()
    for billetera in billeteras:
        billetera.saldo = 1000.00
        billetera.save()
    print(f"  ✓ {billeteras.count()} billeteras restablecidas a $1000.00")

    print("\n✅ Limpieza completada exitosamente")
    print("Ahora puedes crear turnos de prueba sin conflictos.\n")


if __name__ == "__main__":
    try:
        limpiar_turnos()
    except Exception as e:
        print(f"\n❌ Error al limpiar turnos: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
