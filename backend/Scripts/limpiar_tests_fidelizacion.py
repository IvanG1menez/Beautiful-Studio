"""Script de limpieza para datos de testing de fidelización.

Elimina los datos creados por la versión anterior del script
`test_fidelizacion_clientes.py`, que generaba usuarios
`test_fid_clienteN@test.com`, servicios de prueba y turnos
asociados.

No toca los clientes de demo reales (`cliente1-3@beautifulstudio.com`)
ni sus billeteras.

Uso recomendado (desde carpeta `backend/`):

    python Scripts/limpiar_tests_fidelizacion.py
"""


def run():
    """Elimina usuarios, clientes, billeteras, servicios y turnos de testing."""

    from django.contrib.auth import get_user_model

    from apps.clientes.models import Billetera, Cliente
    from apps.servicios.models import CategoriaServicio, Sala, Servicio
    from apps.turnos.models import Turno
    from apps.emails.models import Notificacion

    print("\n🧹 Limpiando datos de testing de fidelización...")

    User = get_user_model()

    # 1) Eliminar usuarios y clientes test_fid_clienteN
    usuarios_test = User.objects.filter(email__icontains="test_fid_cliente")

    total_usuarios = usuarios_test.count()
    total_clientes = 0
    total_turnos = 0
    total_billeteras = 0

    for user in usuarios_test:
        try:
            cliente = Cliente.objects.get(user=user)
        except Cliente.DoesNotExist:
            cliente = None

        if cliente:
            # Eliminar turnos del cliente
            turnos_eliminados, _ = Turno.objects.filter(cliente=cliente).delete()
            total_turnos += turnos_eliminados

            # Eliminar billetera del cliente
            billeteras_eliminadas, _ = Billetera.objects.filter(
                cliente=cliente
            ).delete()
            total_billeteras += billeteras_eliminadas

            # Eliminar perfil Cliente
            cliente.delete()
            total_clientes += 1

        # Finalmente eliminar el usuario
        user.delete()

    print(
        f"   • Usuarios test_fid_cliente eliminados: {total_usuarios} (clientes={total_clientes}, "
        f"turnos={total_turnos}, billeteras={total_billeteras})"
    )

    # 2) Eliminar servicios y estructuras de testing
    nombres_servicios_test = [
        "Test Corte (30 días)",
        "Test Coloración (60 días)",
        "Test Tratamiento (Global)",
    ]

    servicios_eliminados, _ = Servicio.objects.filter(
        nombre__in=nombres_servicios_test
    ).delete()
    print(f"   • Servicios de testing eliminados: {servicios_eliminados}")

    categorias_eliminadas, _ = CategoriaServicio.objects.filter(
        nombre="Testing Fidelización"
    ).delete()
    print(f"   • Categorías de testing eliminadas: {categorias_eliminadas}")

    salas_eliminadas, _ = Sala.objects.filter(
        nombre="Sala Testing Fidelización"
    ).delete()
    print(f"   • Salas de testing eliminadas: {salas_eliminadas}")

    # 3) Opcional: limpiar notificaciones de tipo fidelización usadas en pruebas
    notifs_eliminadas, _ = Notificacion.objects.filter(tipo="fidelizacion").delete()
    print(f"   • Notificaciones de fidelización eliminadas: {notifs_eliminadas}")

    print("\n✅ Limpieza de datos de testing de fidelización completada.\n")


if __name__ == "__main__":
    # Permitir ejecutar el script directamente con
    #   cd backend && python Scripts/limpiar_tests_fidelizacion.py
    #   cd backend/Scripts && python limpiar_tests_fidelizacion.py
    import os
    import sys
    import django

    # Asegurar que la carpeta "backend" (donde está el paquete core) esté en sys.path
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if BASE_DIR not in sys.path:
        sys.path.insert(0, BASE_DIR)

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    django.setup()

    run()
