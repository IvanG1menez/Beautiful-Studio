"""Prepara datos de prueba para reacomodamiento de turnos (Proceso 2).

Objetivo:
- Usar los 3 clientes base ya creados.
- Crear 3 turnos confirmados del mismo servicio/profesional con fechas distintas.
- El turno mas cercano queda en una fecha cancelable y con devolucion de credito.

Usuarios base esperados:
- profesional@beautifulstudio.com
- cliente1@beautifulstudio.com
- cliente2@beautifulstudio.com
- cliente3@beautifulstudio.com

Ejecucion:
- Con django-extensions: python manage.py runscript test_proceso2
- Como script directo:   python Scripts/test_proceso2.py
"""

from __future__ import annotations

from contextlib import contextmanager
from datetime import timedelta
from decimal import Decimal


def _fmt_dt(dt):
    return dt.strftime("%d/%m/%Y %H:%M")


def _get_cliente_por_email(email, User):
    user = User.objects.filter(email=email).select_related("cliente_profile").first()
    if not user:
        raise ValueError(f"No existe usuario base: {email}")
    if not hasattr(user, "cliente_profile"):
        raise ValueError(f"El usuario {email} no tiene perfil de cliente")
    return user.cliente_profile


def _next_free_slot(base_dt, empleado, Turno):
    """Busca el proximo horario libre para ese profesional."""
    dt = base_dt
    while Turno.objects.filter(empleado=empleado, fecha_hora=dt).exists():
        dt += timedelta(minutes=30)
    return dt


@contextmanager
def _mute_turno_post_save_signals(Turno):
    """Evita emails/notificaciones al crear turnos de testing."""
    from django.db.models.signals import post_save
    from apps.turnos import signals as turnos_signals

    post_save.disconnect(turnos_signals.manejar_creacion_turno, sender=Turno)
    post_save.disconnect(turnos_signals.manejar_modificacion_turno, sender=Turno)
    try:
        yield
    finally:
        post_save.connect(turnos_signals.manejar_creacion_turno, sender=Turno)
        post_save.connect(turnos_signals.manejar_modificacion_turno, sender=Turno)


def run():
    from django.contrib.auth import get_user_model
    from django.utils import timezone

    from apps.authentication.models import ConfiguracionGlobal
    from apps.clientes.models import Billetera
    from apps.servicios.models import Servicio
    from apps.turnos.models import Turno, HistorialTurno, LogReasignacion

    User = get_user_model()

    print("\n=== Preparando escenario de testing para Proceso 2 (Reacomodamiento) ===")

    # 1) Cargar recursos base
    profesional_user = (
        User.objects.filter(email="profesional@beautifulstudio.com")
        .select_related("profesional_profile")
        .first()
    )
    if not profesional_user or not hasattr(profesional_user, "profesional_profile"):
        raise ValueError(
            "No existe profesional base. Ejecuta primero Scripts/reset_datos_demo.py"
        )

    empleado = profesional_user.profesional_profile

    servicio = Servicio.objects.filter(nombre="Color completo + Brushing").first()
    if not servicio:
        raise ValueError(
            "No existe el servicio demo. Ejecuta primero Scripts/reset_datos_demo.py"
        )

    # Forzar flags clave para el test de reacomodamiento
    if not servicio.permite_reacomodamiento:
        servicio.permite_reacomodamiento = True
        servicio.save(update_fields=["permite_reacomodamiento"])

    cliente1 = _get_cliente_por_email("cliente1@beautifulstudio.com", User)
    cliente2 = _get_cliente_por_email("cliente2@beautifulstudio.com", User)
    cliente3 = _get_cliente_por_email("cliente3@beautifulstudio.com", User)

    # 2) Limpiar datos previos del escenario para que sea reproducible
    turnos_previos = Turno.objects.filter(
        servicio=servicio,
        empleado=empleado,
        cliente__in=[cliente1, cliente2, cliente3],
        estado__in=["pendiente", "confirmado", "oferta_enviada", "expirada"],
    )

    ids_previos = list(turnos_previos.values_list("id", flat=True))
    if ids_previos:
        LogReasignacion.objects.filter(turno_cancelado_id__in=ids_previos).delete()
        LogReasignacion.objects.filter(turno_ofrecido_id__in=ids_previos).delete()
        HistorialTurno.objects.filter(turno_id__in=ids_previos).delete()
        turnos_previos.delete()
        print(f"- Turnos previos limpiados: {len(ids_previos)}")

    # 3) Calcular fechas del escenario
    config = ConfiguracionGlobal.get_config()
    min_horas_credito = int(config.min_horas_cancelacion_credito or 24)

    ahora = timezone.localtime(timezone.now())

    # Turno mas cercano: debe ser cancelable y generar credito en billetera.
    # Se crea con +4hs extra del minimo para evitar borde de tiempo.
    cercano_base = ahora + timedelta(hours=min_horas_credito + 4)
    cercano_base = cercano_base.replace(minute=0, second=0, microsecond=0)

    # Candidatos posteriores para reacomodamiento
    segundo_base = cercano_base + timedelta(days=2)
    tercero_base = cercano_base + timedelta(days=5)

    fecha_cliente1 = _next_free_slot(cercano_base, empleado, Turno)
    fecha_cliente2 = _next_free_slot(segundo_base, empleado, Turno)
    fecha_cliente3 = _next_free_slot(tercero_base, empleado, Turno)

    # 4) Crear los 3 turnos con sena pagada para probar devolucion de credito
    sena = Decimal(str(servicio.precio or Decimal("0.00"))) * (
        Decimal(str(servicio.porcentaje_sena or Decimal("0.00"))) / Decimal("100")
    )
    sena = sena.quantize(Decimal("0.01"))

    with _mute_turno_post_save_signals(Turno):
        turno_cercano = Turno.objects.create(
            cliente=cliente1,
            empleado=empleado,
            servicio=servicio,
            fecha_hora=fecha_cliente1,
            estado="confirmado",
            senia_pagada=sena,
            notas_cliente="TEST_PROCESO2_CERCANO_CANCELABLE",
        )

        turno_candidato_1 = Turno.objects.create(
            cliente=cliente2,
            empleado=empleado,
            servicio=servicio,
            fecha_hora=fecha_cliente2,
            estado="confirmado",
            senia_pagada=sena,
            notas_cliente="TEST_PROCESO2_CANDIDATO_1",
        )

        turno_candidato_2 = Turno.objects.create(
            cliente=cliente3,
            empleado=empleado,
            servicio=servicio,
            fecha_hora=fecha_cliente3,
            estado="confirmado",
            senia_pagada=sena,
            notas_cliente="TEST_PROCESO2_CANDIDATO_2",
        )

    # 5) Dejar billeteras visibles para validar antes/despues de cancelar
    billetera1, _ = Billetera.objects.get_or_create(cliente=cliente1)
    billetera2, _ = Billetera.objects.get_or_create(cliente=cliente2)
    billetera3, _ = Billetera.objects.get_or_create(cliente=cliente3)

    print("\nEscenario creado correctamente:\n")
    print(
        f"1) Turno MAS CERCANO (cancelable con credito): ID={turno_cercano.id} | "
        f"cliente=cliente1@beautifulstudio.com | fecha={_fmt_dt(fecha_cliente1)} | sena=${sena}"
    )
    print(
        f"2) Turno candidato: ID={turno_candidato_1.id} | "
        f"cliente=cliente2@beautifulstudio.com | fecha={_fmt_dt(fecha_cliente2)}"
    )
    print(
        f"3) Turno candidato: ID={turno_candidato_2.id} | "
        f"cliente=cliente3@beautifulstudio.com | fecha={_fmt_dt(fecha_cliente3)}"
    )

    print("\nValidacion de cancelacion para credito:")
    horas_hasta_turno = (fecha_cliente1 - ahora).total_seconds() / 3600
    print(f"- Minimo global para acreditar credito: {min_horas_credito}hs")
    print(f"- Horas del turno cercano respecto de ahora: {horas_hasta_turno:.2f}hs")
    print(f"- turno.puede_cancelar(): {turno_cercano.puede_cancelar()}")
    print(
        f"- Al cancelar ese turno se deberia acreditar aprox: ${sena} en la billetera de cliente1"
    )

    print("\nSaldos actuales:")
    print(f"- cliente1 saldo: ${billetera1.saldo}")
    print(f"- cliente2 saldo: ${billetera2.saldo}")
    print(f"- cliente3 saldo: ${billetera3.saldo}")

    print("\nSiguiente paso sugerido:")
    print(
        f"- Cancelar el turno ID {turno_cercano.id} desde la UI/API para gatillar "
        "devolucion de credito y reacomodamiento."
    )
    print("\n=== Fin: escenario Proceso 2 listo ===\n")


if __name__ == "__main__":
    import os
    import sys
    import django

    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if BASE_DIR not in sys.path:
        sys.path.insert(0, BASE_DIR)

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    django.setup()
    run()
