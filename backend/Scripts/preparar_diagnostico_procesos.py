"""Prepara datos reproducibles para la pantalla de diagnostico de procesos.

Uso desde ``backend/``:
    python Scripts/preparar_diagnostico_procesos.py

Deja listos tres escenarios:
- Optimizacion de agenda: un turno cancelable y dos candidatos posteriores.
- Clientes olvidados: dos clientes inactivos, uno con saldo y otro sin saldo.
- Fidelidad por rachas: un cliente con racha en 4 y un quinto turno para completar.

No prepara Google Auth porque ese flujo se prueba por separado.
"""

from __future__ import annotations

from contextlib import contextmanager
from datetime import timedelta, time
from decimal import Decimal


DIAG_PREFIX = "DIAG_PROCESOS"


@contextmanager
def _mute_turno_post_save_signals(Turno):
    """Evita emails/notificaciones al crear datos base de diagnostico."""

    from django.db.models.signals import post_save
    from apps.turnos import signals as turnos_signals

    post_save.disconnect(turnos_signals.manejar_creacion_turno, sender=Turno)
    post_save.disconnect(turnos_signals.manejar_modificacion_turno, sender=Turno)
    try:
        yield
    finally:
        post_save.connect(turnos_signals.manejar_creacion_turno, sender=Turno)
        post_save.connect(turnos_signals.manejar_modificacion_turno, sender=Turno)


def _fmt_dt(dt):
    return dt.strftime("%d/%m/%Y %H:%M")


def _next_free_slot(base_dt, empleado, Turno):
    dt = base_dt.replace(second=0, microsecond=0)
    while Turno.objects.filter(empleado=empleado, fecha_hora=dt).exclude(
        estado__in=["cancelado", "no_asistio", "expirada"]
    ).exists():
        dt += timedelta(minutes=30)
    return dt


def _ensure_base_data():
    """Asegura usuarios/servicio demo sin resetear toda la base."""

    from Scripts import reset_datos_demo
    from apps.empleados.models import Empleado
    from apps.servicios.models import Servicio

    empleado = Empleado.objects.filter(user__email="profesional@beautifulstudio.com").first()
    servicio = Servicio.objects.filter(nombre="Color completo + Brushing").first()

    if not empleado or not servicio:
        print("Base demo incompleta. Creando usuarios, profesional y servicio demo...")
        reset_datos_demo.crear_usuarios_base()


def _ensure_diag_cliente(email, first_name, last_name):
    from django.contrib.auth import get_user_model
    from apps.clientes.models import Cliente

    User = get_user_model()
    username = email.split("@")[0]
    user, created = User.objects.get_or_create(
        email=email,
        defaults={
            "username": username,
            "first_name": first_name,
            "last_name": last_name,
            "role": "cliente",
            "is_staff": False,
            "is_superuser": False,
        },
    )
    if created:
        user.set_password("cliente123")
    user.username = user.username or username
    user.first_name = first_name
    user.last_name = last_name
    user.role = "cliente"
    user.is_active = True
    user.save()

    cliente, _ = Cliente.objects.get_or_create(user=user)
    cliente.is_active = True
    cliente.save()
    return cliente


def _clean_previous_diag_data(clientes):
    from apps.emails.models import Notificacion
    from apps.turnos.models import (
        ClienteStreakStats,
        HistorialTurno,
        LogReasignacion,
        StreakAuditLog,
        StreakExpiryAlertLog,
        StreakRewardEvent,
        Turno,
    )

    turno_ids = list(
        Turno.objects.filter(cliente__in=clientes)
        .filter(notas_cliente__startswith=DIAG_PREFIX)
        .values_list("id", flat=True)
    )
    if turno_ids:
        LogReasignacion.objects.filter(turno_cancelado_id__in=turno_ids).delete()
        LogReasignacion.objects.filter(turno_ofrecido_id__in=turno_ids).delete()
        HistorialTurno.objects.filter(turno_id__in=turno_ids).delete()
        StreakRewardEvent.objects.filter(turno_id__in=turno_ids).delete()
        StreakAuditLog.objects.filter(turno_id__in=turno_ids).delete()
        Turno.objects.filter(id__in=turno_ids).delete()

    ClienteStreakStats.objects.filter(cliente__in=clientes).delete()
    StreakExpiryAlertLog.objects.filter(cliente__in=clientes).delete()
    Notificacion.objects.filter(usuario__in=[cliente.user for cliente in clientes]).delete()


def _ensure_schedule(empleado):
    from apps.empleados.models import HorarioEmpleado

    for dia in range(7):
        HorarioEmpleado.objects.get_or_create(
            empleado=empleado,
            dia_semana=dia,
            hora_inicio=time(10, 0),
            defaults={"hora_fin": time(19, 0), "is_active": True},
        )


def _prepare_config():
    from apps.authentication.models import ConfiguracionGlobal

    config = ConfiguracionGlobal.get_config()
    config.min_horas_cancelacion_credito = 24
    config.margen_fidelizacion_dias = 45
    config.descuento_fidelizacion_pct = Decimal("15.00")
    config.streak_expiration_days = 180
    config.streak_bonus_amount = Decimal("1000.00")
    config.streak_alert_days = [3, 1]
    config.save()
    return config


def _prepare_optimizacion(empleado, servicio, clientes, config):
    from django.utils import timezone
    from apps.clientes.models import Billetera
    from apps.turnos.models import Turno

    cliente_cancelado, cliente_medio, cliente_lejano = clientes
    now = timezone.now()
    base = now + timedelta(hours=int(config.min_horas_cancelacion_credito or 24) + 4)
    base = base.replace(minute=0, second=0, microsecond=0)

    fecha_cancelado = _next_free_slot(base, empleado, Turno)
    fecha_medio = _next_free_slot(fecha_cancelado + timedelta(days=3), empleado, Turno)
    fecha_lejano = _next_free_slot(fecha_cancelado + timedelta(days=9), empleado, Turno)
    sena = (Decimal(servicio.precio or 0) * Decimal("0.50")).quantize(Decimal("0.01"))

    with _mute_turno_post_save_signals(Turno):
        turno_cancelado = Turno.objects.create(
            cliente=cliente_cancelado,
            empleado=empleado,
            servicio=servicio,
            fecha_hora=fecha_cancelado,
            estado="confirmado",
            tipo_pago="SENIA",
            senia_pagada=sena,
            precio_final=servicio.precio,
            notas_cliente=f"{DIAG_PREFIX}_OPT_CANCELAR",
        )
        turno_medio = Turno.objects.create(
            cliente=cliente_medio,
            empleado=empleado,
            servicio=servicio,
            fecha_hora=fecha_medio,
            estado="confirmado",
            tipo_pago="SENIA",
            senia_pagada=sena,
            precio_final=servicio.precio,
            notas_cliente=f"{DIAG_PREFIX}_OPT_CANDIDATO_MEDIO",
        )
        turno_lejano = Turno.objects.create(
            cliente=cliente_lejano,
            empleado=empleado,
            servicio=servicio,
            fecha_hora=fecha_lejano,
            estado="confirmado",
            tipo_pago="SENIA",
            senia_pagada=sena,
            precio_final=servicio.precio,
            notas_cliente=f"{DIAG_PREFIX}_OPT_CANDIDATO_LEJANO",
        )

    for cliente in clientes:
        Billetera.objects.get_or_create(cliente=cliente)

    return turno_cancelado, turno_medio, turno_lejano


def _prepare_clientes_olvidados(empleado, servicio, clientes):
    from django.utils import timezone
    from apps.clientes.models import Billetera
    from apps.turnos.models import Turno

    cliente_saldo, cliente_descuento = clientes
    old_base = timezone.now() - timedelta(days=75)

    billetera_saldo, _ = Billetera.objects.get_or_create(cliente=cliente_saldo)
    billetera_saldo.saldo = Decimal("1500.00")
    billetera_saldo.save(update_fields=["saldo"])

    billetera_descuento, _ = Billetera.objects.get_or_create(cliente=cliente_descuento)
    billetera_descuento.saldo = Decimal("0.00")
    billetera_descuento.save(update_fields=["saldo"])

    with _mute_turno_post_save_signals(Turno):
        turno_saldo = Turno.objects.create(
            cliente=cliente_saldo,
            empleado=empleado,
            servicio=servicio,
            fecha_hora=old_base.replace(minute=10, second=0, microsecond=0),
            estado="completado",
            fecha_hora_completado=old_base,
            precio_final=servicio.precio,
            notas_cliente=f"{DIAG_PREFIX}_FID_CON_SALDO",
        )
        turno_descuento = Turno.objects.create(
            cliente=cliente_descuento,
            empleado=empleado,
            servicio=servicio,
            fecha_hora=(old_base - timedelta(hours=2)).replace(minute=20, second=0, microsecond=0),
            estado="completado",
            fecha_hora_completado=old_base - timedelta(hours=2),
            precio_final=servicio.precio,
            notas_cliente=f"{DIAG_PREFIX}_FID_SIN_SALDO",
        )

    return turno_saldo, turno_descuento


def _prepare_racha(empleado, servicio, cliente, config):
    from django.utils import timezone
    from apps.turnos.models import ClienteStreakStats, Turno

    now = timezone.now()
    completed_turnos = []

    with _mute_turno_post_save_signals(Turno):
        for idx in range(4):
            fecha = now - timedelta(days=40 - (idx * 7))
            completed_turnos.append(
                Turno.objects.create(
                    cliente=cliente,
                    empleado=empleado,
                    servicio=servicio,
                    fecha_hora=fecha,
                    estado="completado",
                    fecha_hora_completado=fecha,
                    precio_final=servicio.precio,
                    notas_cliente=f"{DIAG_PREFIX}_RACHA_COMPLETADO_{idx + 1}",
                )
            )

        turno_hito = Turno.objects.create(
            cliente=cliente,
            empleado=empleado,
            servicio=servicio,
            fecha_hora=now + timedelta(hours=2),
            estado="confirmado",
            precio_final=servicio.precio,
            notas_cliente=f"{DIAG_PREFIX}_RACHA_TURNO_HITO_5",
        )

    last_completed = completed_turnos[-1]
    ClienteStreakStats.objects.update_or_create(
        cliente=cliente,
        defaults={
            "streak_count": 4,
            "last_completed_turno": last_completed,
            "last_completed_at": last_completed.fecha_hora_completado,
            "next_expiration_at": last_completed.fecha_hora_completado
            + timedelta(days=int(config.streak_expiration_days or 180)),
        },
    )

    return turno_hito


def run():
    from apps.empleados.models import Empleado, EmpleadoServicio
    from apps.servicios.models import Servicio

    print("\n=== Preparando diagnostico de procesos automaticos ===")
    _ensure_base_data()

    config = _prepare_config()
    empleado = Empleado.objects.get(user__email="profesional@beautifulstudio.com")
    servicio = Servicio.objects.get(nombre="Color completo + Brushing")
    servicio.tiempo_espera_respuesta = 15
    servicio.frecuencia_recurrencia_dias = 45
    servicio.bono_reacomodamiento_senia = Decimal("1000.00")
    servicio.save(update_fields=["tiempo_espera_respuesta", "frecuencia_recurrencia_dias", "bono_reacomodamiento_senia"])
    EmpleadoServicio.objects.get_or_create(empleado=empleado, servicio=servicio)
    _ensure_schedule(empleado)

    clientes = {
        "opt_cancel": _ensure_diag_cliente("diag.opt.cancel@beautifulstudio.com", "Olivia", "Cancelacion"),
        "opt_medio": _ensure_diag_cliente("diag.opt.medio@beautifulstudio.com", "Martina", "Candidata"),
        "opt_lejano": _ensure_diag_cliente("diag.opt.lejano@beautifulstudio.com", "Sofia", "Lejana"),
        "fid_saldo": _ensure_diag_cliente("diag.fid.saldo@beautifulstudio.com", "Clara", "Con Saldo"),
        "fid_descuento": _ensure_diag_cliente("diag.fid.descuento@beautifulstudio.com", "Paula", "Sin Saldo"),
        "racha": _ensure_diag_cliente("diag.racha@beautifulstudio.com", "Rocio", "Fiel"),
    }

    _clean_previous_diag_data(list(clientes.values()))

    turno_cancelado, turno_medio, turno_lejano = _prepare_optimizacion(
        empleado,
        servicio,
        [clientes["opt_cancel"], clientes["opt_medio"], clientes["opt_lejano"]],
        config,
    )
    turno_fid_saldo, turno_fid_descuento = _prepare_clientes_olvidados(
        empleado,
        servicio,
        [clientes["fid_saldo"], clientes["fid_descuento"]],
    )
    turno_racha = _prepare_racha(empleado, servicio, clientes["racha"], config)

    print("\nEscenarios listos para http://localhost:3000/dashboard/propietario/diagnostico")
    print("\n1) Optimizacion de agenda")
    print(f"   ID a pegar en 'ID del Turno a Cancelar': {turno_cancelado.id}")
    print(f"   Candidato mas lejano esperado primero: turno {turno_lejano.id} ({_fmt_dt(turno_lejano.fecha_hora)})")
    print(f"   Candidato siguiente al simular no respuesta: turno {turno_medio.id} ({_fmt_dt(turno_medio.fecha_hora)})")

    print("\n2) Clientes olvidados")
    print("   Dejar vacio 'Dias de Inactividad' o usar 45.")
    print(f"   Cliente con saldo: {clientes['fid_saldo'].user.email} (turno ref {turno_fid_saldo.id})")
    print(f"   Cliente sin saldo: {clientes['fid_descuento'].user.email} (turno ref {turno_fid_descuento.id})")

    print("\n3) Fidelidad por rachas")
    print(f"   ID a pegar en 'ID del Turno a Completar': {turno_racha.id}")
    print("   El cliente queda con racha=4; al completar este turno llega al hito 5.")
    print("\nCredenciales utiles:")
    print("   propietario@beautifulstudio.com / admin123")
    print("\n=== Fin preparacion diagnostico ===\n")


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
