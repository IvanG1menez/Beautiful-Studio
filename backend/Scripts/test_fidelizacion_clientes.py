"""Script de testing para el Proceso 1: Fidelización de Clientes.

Prepara turnos completados en el pasado para los 3 clientes
de demo creados por `reset_datos_demo.py`:

- cliente1@beautifulstudio.com (con saldo en billetera)
- cliente2@beautifulstudio.com (con saldo en billetera)
- cliente3@beautifulstudio.com (sin saldo en billetera)

Todos quedan con un turno completado antiguo del servicio
"Color completo + Brushing", de forma que queden como
candidatos a fidelización tanto para la tarea Celery
`enviar_emails_fidelizacion_clientes` como para el panel de
Diagnóstico del propietario.

Uso recomendado (desde carpeta `backend/`):

    python Scripts/test_fidelizacion_clientes.py

Luego ir a:
    http://localhost:3000/dashboard/propietario/diagnostico

En la sección "Proceso 1: Fidelización de Clientes" gatillar el
proceso (con o sin filtros) o ejecutar manualmente la tarea Celery
desde el shell de Django.
"""

from datetime import timedelta


def run():
    """Crea datos de prueba para fidelización usando clientes de demo.

    - Usa los clientes `cliente1-3@beautifulstudio.com` ya creados
      por `reset_datos_demo.py`
    - Asegura sus billeteras (1 y 2 con saldo, 3 sin saldo)
    - Crea turnos completados hace 60 días con el servicio
      "Color completo + Brushing" y el profesional de demo
    """

    from decimal import Decimal

    from django.contrib.auth import get_user_model
    from django.utils import timezone

    from apps.clientes.models import Billetera, Cliente
    from apps.empleados.models import Empleado
    from apps.servicios.models import Servicio
    from apps.turnos.models import Turno

    print(
        "\n🧪 Preparando datos de prueba para Fidelización de Clientes (clientes de demo)..."
    )

    User = get_user_model()

    # 1) Obtener el profesional de demo
    empleado = Empleado.objects.select_related("user").first()
    if not empleado:
        raise SystemExit(
            "❌ No hay profesionales (Empleado) en la base. Ejecutá primero reset_datos_demo.run()"
        )

    print(
        f"   • Usando profesional: {empleado.nombre_completo} ({empleado.user.email})"
    )

    # 2) Obtener el servicio de demo "Color completo + Brushing"
    servicio = Servicio.objects.filter(nombre="Color completo + Brushing").first()
    if not servicio:
        servicio = Servicio.objects.filter(is_active=True).first()

    if not servicio:
        raise SystemExit(
            "❌ No se encontró el servicio de demo ni ningún servicio activo. Ejecutá primero reset_datos_demo.run()"
        )

    print(
        f"   • Usando servicio: {servicio.nombre} (frecuencia {servicio.frecuencia_recurrencia_dias} días)"
    )

    # 3) Obtener los 3 clientes de demo
    demo_emails = [
        "cliente1@beautifulstudio.com",
        "cliente2@beautifulstudio.com",
        "cliente3@beautifulstudio.com",
    ]

    clientes = []
    for email in demo_emails:
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise SystemExit(
                f"❌ No se encontró el usuario {email}. Ejecutá primero reset_datos_demo.run()"
            )

        cliente, _ = Cliente.objects.get_or_create(user=user)
        clientes.append(cliente)

    ahora = timezone.now()

    # 4) Asegurar billeteras con los montos deseados
    billetera1, _ = Billetera.objects.get_or_create(cliente=clientes[0])
    billetera1.saldo = Decimal("1000.00")
    billetera1.save(update_fields=["saldo"])

    billetera2, _ = Billetera.objects.get_or_create(cliente=clientes[1])
    billetera2.saldo = Decimal("500.00")
    billetera2.save(update_fields=["saldo"])

    billetera3, _ = Billetera.objects.get_or_create(cliente=clientes[2])
    billetera3.saldo = Decimal("0.00")
    billetera3.save(update_fields=["saldo"])

    print("   • Billeteras ajustadas: cliente1=1000, cliente2=500, cliente3=0")

    # 5) Limpiar turnos previos de estos clientes para evitar ruido
    for cliente in clientes:
        eliminados, _ = Turno.objects.filter(cliente=cliente).delete()
        if eliminados:
            print(
                f"   • Se eliminaron {eliminados} turnos previos de {cliente.nombre_completo}"
            )

    # 6) Crear un turno completado antiguo para cada cliente
    escenarios = [
        (clientes[0], 60),
        (clientes[1], 60),
        (clientes[2], 60),
    ]

    for idx, (cliente, dias) in enumerate(escenarios, start=1):
        # Evitar colisión con la restricción única (empleado, fecha_hora)
        # usando un pequeño offset distinto por cliente
        fecha_turno = ahora - timedelta(days=dias, minutes=idx * 10)
        turno = Turno.objects.create(
            cliente=cliente,
            empleado=empleado,
            servicio=servicio,
            sala=getattr(servicio.categoria, "sala", None),
            fecha_hora=fecha_turno,
            estado="completado",
            fecha_hora_completado=fecha_turno,
            precio_final=servicio.precio,
        )
        print(
            f"   • Turno {idx}: cliente={cliente.nombre_completo}, servicio={servicio.nombre}, "
            f"dias_atras={dias}, turno_id={turno.id}"
        )

    print("\n✅ Datos de fidelización para clientes de demo creados.")
    print("   - Clientes: ", ", ".join([c.user.email for c in clientes]))
    print(f"   - Servicio: {servicio.nombre}")
    print("\nSiguiente paso sugerido:")
    print("  1) Abrir el panel de Diagnóstico del propietario.")
    print("  2) Gatillar 'Fidelización de Clientes' (con o sin filtro de días).")
    print(
        "  3) O bien, desde un shell de Django ejecutar: "
        "from apps.emails.tasks import enviar_emails_fidelizacion_clientes; "
        "enviar_emails_fidelizacion_clientes()"
    )


if __name__ == "__main__":
    # Permitir ejecutar el script directamente con `python Scripts/test_fidelizacion_clientes.py`
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
