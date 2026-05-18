"""Limpia reservas creadas desde el panel profesional.

Uso desde ``backend/``:

- Ver qué borraría:
  ``python Scripts/limpiar_reservas_presenciales_profesional.py --dry-run``

- Ejecutar con confirmación interactiva:
  ``python Scripts/limpiar_reservas_presenciales_profesional.py``

- Ejecutar sin preguntar:
  ``python Scripts/limpiar_reservas_presenciales_profesional.py --force``

- Con django-extensions:
  ``python manage.py runscript limpiar_reservas_presenciales_profesional --script-args --dry-run``

Elimina únicamente datos creados desde ``/dashboard/profesional/reservar-turno``:
- Turnos con ``canal_reserva=panel_profesional`` y pago efectivo/QR.
- Pagos Mercado Pago, órdenes QR staff y preferencias canceladas asociadas.
- Historiales/notificaciones/tokens de acceso relacionados.
- Clientes y usuarios creados como walk-in por ese flujo, solo si no tienen otros turnos.

No elimina clientes existentes usados por esos turnos.
Los emails ya enviados no pueden borrarse del proveedor SMTP; se eliminan los tokens y
notificaciones persistidas en la BD.
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass

import django
from django.conf import settings
from django.db import transaction
from django.db.models import Q


if not settings.configured:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if BASE_DIR not in sys.path:
        sys.path.insert(0, BASE_DIR)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    django.setup()


@dataclass
class LimpiezaResumen:
    turnos: int = 0
    pagos_mp: int = 0
    ordenes_qr: int = 0
    preferencias_canceladas: int = 0
    historial_turnos: int = 0
    tokens_password: int = 0
    notificaciones: int = 0
    auditorias: int = 0
    clientes: int = 0
    usuarios: int = 0
    reasignaciones: int = 0
    streak_events: int = 0
    streak_logs: int = 0
    history_turnos: int = 0
    history_clientes: int = 0


def _delete_or_count(queryset, dry_run: bool) -> int:
    count = queryset.count()
    if not dry_run and count:
        queryset.delete()
    return count


def _target_turnos(include_propietario: bool = False):
    from apps.turnos.models import Turno

    canales = ["panel_profesional"]
    if include_propietario:
        canales.append("panel_propietario")

    return Turno.objects.filter(
        canal_reserva__in=canales,
        metodo_pago__in=["efectivo", "mercadopago_qr", "mercadopago_manual"],
    )


def run(*script_args, force: bool = False, dry_run: bool = False, include_propietario: bool = False):
    from django.contrib.auth import get_user_model

    from apps.authentication.models import AuditoriaAcciones
    from apps.clientes.models import Cliente
    from apps.emails.models import Notificacion, NotificacionConfig, PasswordResetToken
    from apps.mercadopago.models import (
        OrdenMercadoPagoPresencial,
        PagoMercadoPago,
        PreferenciaMercadoPagoCancelada,
    )
    from apps.turnos.models import (
        HistorialTurno,
        LogReasignacion,
        StreakAuditLog,
        StreakRewardEvent,
        Turno,
    )

    args = set(str(arg) for arg in script_args)
    force = force or "--force" in args
    dry_run = dry_run or "--dry-run" in args
    include_propietario = include_propietario or "--include-propietario" in args

    User = get_user_model()

    target_turnos = _target_turnos(include_propietario=include_propietario)
    turno_ids = list(target_turnos.values_list("id", flat=True))
    walkin_cliente_ids = list(
        target_turnos.filter(es_cliente_registrado=False).values_list("cliente_id", flat=True).distinct()
    )

    ordenes_qr = OrdenMercadoPagoPresencial.objects.filter(
        Q(reference_id__startswith="staff-qr-")
        & (
            Q(payload__canal_reserva="panel_profesional")
            | Q(payload__canal_reserva="panel_propietario")
            if include_propietario
            else Q(payload__canal_reserva="panel_profesional")
        )
    )
    qr_reference_ids = list(ordenes_qr.values_list("reference_id", flat=True))

    pagos_qs = PagoMercadoPago.objects.filter(
        Q(turno_id__in=turno_ids) | Q(preference_id__in=qr_reference_ids)
    )
    preference_ids = list(pagos_qs.values_list("preference_id", flat=True)) + qr_reference_ids

    # Solo borrar clientes walk-in creados por este flujo si no tienen otros turnos.
    clientes_borrables = Cliente.objects.filter(id__in=walkin_cliente_ids).exclude(
        turnos__canal_reserva__isnull=False,
        turnos__id__in=Turno.objects.exclude(id__in=turno_ids).values("id"),
    )
    cliente_ids_borrables = list(clientes_borrables.values_list("id", flat=True))
    user_ids_borrables = list(clientes_borrables.values_list("user_id", flat=True))

    resumen = LimpiezaResumen(turnos=len(turno_ids))

    print("\nLimpieza de reservas presenciales del panel profesional")
    print(f"  Turnos objetivo: {len(turno_ids)}")
    print(f"  Clientes walk-in borrables: {len(cliente_ids_borrables)}")
    print(f"  Usuarios walk-in borrables: {len(user_ids_borrables)}")
    print(f"  Ordenes QR staff: {ordenes_qr.count()}")
    if dry_run:
        print("\nModo dry-run: no se borrara nada.")

    if not force and not dry_run:
        respuesta = input("\nEscribi 'si' para borrar estos datos: ").strip().lower()
        if respuesta != "si":
            print("Operacion cancelada.")
            return resumen

    with transaction.atomic():
        # Dependencias directas de turnos con FK PROTECT.
        resumen.reasignaciones += _delete_or_count(
            LogReasignacion.objects.filter(
                Q(turno_cancelado_id__in=turno_ids)
                | Q(turno_ofrecido_id__in=turno_ids)
                | Q(cliente_notificado_id__in=cliente_ids_borrables)
            ),
            dry_run,
        )
        resumen.historial_turnos += _delete_or_count(
            HistorialTurno.objects.filter(turno_id__in=turno_ids),
            dry_run,
        )
        resumen.streak_events += _delete_or_count(
            StreakRewardEvent.objects.filter(Q(turno_id__in=turno_ids) | Q(cliente_id__in=cliente_ids_borrables)),
            dry_run,
        )
        resumen.streak_logs += _delete_or_count(
            StreakAuditLog.objects.filter(Q(turno_id__in=turno_ids) | Q(cliente_id__in=cliente_ids_borrables)),
            dry_run,
        )

        resumen.pagos_mp += _delete_or_count(pagos_qs, dry_run)
        resumen.preferencias_canceladas += _delete_or_count(
            PreferenciaMercadoPagoCancelada.objects.filter(preference_id__in=preference_ids),
            dry_run,
        )
        resumen.ordenes_qr += _delete_or_count(ordenes_qr, dry_run)

        # Historial simple_history.
        try:
            resumen.history_turnos += _delete_or_count(
                Turno.history.model.objects.filter(id__in=turno_ids),
                dry_run,
            )
        except Exception as exc:
            print(f"  Aviso: no se pudo limpiar historial simple de turnos: {exc}")

        resumen.turnos = _delete_or_count(Turno.objects.filter(id__in=turno_ids), dry_run)

        # Mails/notificaciones persistidos y auditoria vinculada a clientes/tokens.
        token_qs = PasswordResetToken.objects.filter(user_id__in=user_ids_borrables)
        token_ids = list(token_qs.values_list("id", flat=True))
        resumen.tokens_password += _delete_or_count(token_qs, dry_run)
        resumen.notificaciones += _delete_or_count(
            Notificacion.objects.filter(usuario_id__in=user_ids_borrables),
            dry_run,
        )
        _delete_or_count(NotificacionConfig.objects.filter(user_id__in=user_ids_borrables), dry_run)

        resumen.auditorias += _delete_or_count(
            AuditoriaAcciones.objects.filter(
                Q(modelo_afectado="Cliente", objeto_id__in=cliente_ids_borrables)
                | Q(modelo_afectado="PasswordResetToken", objeto_id__in=token_ids)
                | Q(usuario_id__in=user_ids_borrables)
            ),
            dry_run,
        )

        try:
            resumen.history_clientes += _delete_or_count(
                Cliente.history.model.objects.filter(id__in=cliente_ids_borrables),
                dry_run,
            )
        except Exception as exc:
            print(f"  Aviso: no se pudo limpiar historial simple de clientes: {exc}")

        resumen.clientes += _delete_or_count(Cliente.objects.filter(id__in=cliente_ids_borrables), dry_run)
        resumen.usuarios += _delete_or_count(User.objects.filter(id__in=user_ids_borrables), dry_run)

        if dry_run:
            transaction.set_rollback(True)

    print("\nResumen:")
    for campo, valor in resumen.__dict__.items():
        print(f"  - {campo}: {valor}")
    print("\nListo.\n")
    return resumen


if __name__ == "__main__":
    args = set(sys.argv[1:])
    run(
        force="--force" in args,
        dry_run="--dry-run" in args,
        include_propietario="--include-propietario" in args,
    )
