"""
Servicio de reasignación automática de turnos tras cancelaciones
"""

from decimal import Decimal
import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from simple_history.utils import update_change_reason

from apps.turnos.models import Turno, LogReasignacion
from apps.turnos.utils import get_system_history_user
from apps.emails.services import EmailService

logger = logging.getLogger(__name__)

ESTADOS_ACTIVOS = ["pendiente", "confirmado", "en_proceso", "oferta_enviada"]


def _save_turno_with_history(turno: Turno, reason: str, update_fields=None) -> None:
    turno._history_user = get_system_history_user()
    update_change_reason(turno, reason)
    if update_fields:
        turno.save(update_fields=update_fields)
    else:
        turno.save()


def _slot_libre(turno_cancelado: Turno) -> bool:
    """Valida que el hueco siga libre antes de enviar o aceptar una oferta."""
    return (
        not Turno.objects.filter(
            empleado=turno_cancelado.empleado,
            fecha_hora=turno_cancelado.fecha_hora,
            estado__in=ESTADOS_ACTIVOS,
        )
        .exclude(id=turno_cancelado.id)
        .exists()
    )


def _calcular_monto_final(
    precio_total: Decimal, descuento: Decimal, senia: Decimal
) -> Decimal:
    monto = (precio_total - descuento) - senia
    if monto < 0:
        return Decimal("0.00")
    return monto


def iniciar_reasignacion_turno(turno_cancelado_id: int) -> dict:
    """
    Selecciona un candidato y envía la oferta de reasignación.
    Retorna un dict con el estado de la operación.
    """
    try:
        turno_cancelado = Turno.objects.select_related(
            "servicio", "empleado__user"
        ).get(id=turno_cancelado_id)
    except Turno.DoesNotExist:
        logger.warning(f"Turno cancelado {turno_cancelado_id} no existe")
        return {"status": "turno_no_encontrado"}

    if turno_cancelado.estado != "cancelado":
        return {"status": "turno_no_cancelado"}

    if turno_cancelado.fecha_hora <= timezone.now():
        return {"status": "turno_fuera_de_ventana"}

    if not _slot_libre(turno_cancelado):
        return {"status": "hueco_no_disponible"}

    candidato = (
        Turno.objects.filter(
            servicio=turno_cancelado.servicio,
            estado="confirmado",
            fecha_hora__gt=turno_cancelado.fecha_hora,
        )
        .select_related("cliente__user", "servicio")
        .order_by("-fecha_hora")
        .first()
    )

    if not candidato:
        return {"status": "sin_candidatos"}

    descuento = Decimal(turno_cancelado.servicio.descuento_reasignacion or 0)
    senia_pagada = Decimal(candidato.senia_pagada or 0)
    precio_total = Decimal(turno_cancelado.servicio.precio)
    monto_final = _calcular_monto_final(precio_total, descuento, senia_pagada)

    log_reasignacion = LogReasignacion.objects.create(
        turno_cancelado=turno_cancelado,
        turno_ofrecido=candidato,
        cliente_notificado=candidato.cliente,
        monto_descuento=descuento,
        expires_at=timezone.now() + timedelta(minutes=15),
    )

    candidato.estado = "oferta_enviada"
    _save_turno_with_history(
        candidato,
        "Oferta enviada por reasignacion",
        update_fields=["estado", "updated_at"],
    )

    enviado = EmailService.enviar_email_oferta_reasignacion(
        turno_cancelado=turno_cancelado,
        turno_ofrecido=candidato,
        log_reasignacion=log_reasignacion,
        monto_final=monto_final,
        monto_descuento=descuento,
        senia_pagada=senia_pagada,
    )

    if not enviado:
        logger.error(
            f"No se pudo enviar email de oferta para turno {candidato.id}. Revirtiendo estado."
        )
        candidato.estado = "confirmado"
        _save_turno_with_history(
            candidato,
            "Reversion de oferta enviada",
            update_fields=["estado", "updated_at"],
        )
        log_reasignacion.estado_final = "rechazada"
        log_reasignacion.save(update_fields=["estado_final"])
        return {"status": "email_fallido"}

    from apps.turnos.tasks import expirar_oferta_reasignacion

    expirar_oferta_reasignacion.apply_async(
        args=[log_reasignacion.id], countdown=15 * 60
    )

    return {"status": "oferta_enviada", "log_id": log_reasignacion.id}


def expirar_oferta_reasignacion(log_id: int) -> dict:
    """
    Marca la oferta como expirada y continúa con el siguiente candidato.
    """
    try:
        log_reasignacion = LogReasignacion.objects.select_related(
            "turno_cancelado", "turno_ofrecido"
        ).get(id=log_id)
    except LogReasignacion.DoesNotExist:
        logger.warning(f"Log reasignación {log_id} no existe")
        return {"status": "log_no_encontrado"}

    if log_reasignacion.estado_final:
        return {"status": "ya_resuelta", "estado": log_reasignacion.estado_final}

    if log_reasignacion.expires_at > timezone.now():
        return {"status": "aun_vigente"}

    log_reasignacion.estado_final = "expirada"
    log_reasignacion.save(update_fields=["estado_final"])

    if (
        log_reasignacion.turno_ofrecido
        and log_reasignacion.turno_ofrecido.estado == "oferta_enviada"
    ):
        turno_ofrecido = log_reasignacion.turno_ofrecido
        turno_ofrecido.estado = "expirada"
        _save_turno_with_history(
            turno_ofrecido,
            "Oferta expirada por reasignacion",
            update_fields=["estado", "updated_at"],
        )

    iniciar_reasignacion_turno(log_reasignacion.turno_cancelado_id)

    return {"status": "expirada"}


def responder_oferta_reasignacion(token: str, accion: str) -> dict:
    """
    Procesa la respuesta del cliente a una oferta de reasignación.
    """
    try:
        log_reasignacion = LogReasignacion.objects.select_related(
            "turno_cancelado",
            "turno_ofrecido",
            "turno_cancelado__servicio",
            "turno_cancelado__empleado__user",
            "turno_ofrecido__cliente__user",
        ).get(token=token)
    except LogReasignacion.DoesNotExist:
        return {"status": "token_invalido"}

    if log_reasignacion.estado_final:
        return {
            "status": "ya_resuelta",
            "estado": log_reasignacion.estado_final,
        }

    if log_reasignacion.expires_at <= timezone.now():
        log_reasignacion.estado_final = "expirada"
        log_reasignacion.save(update_fields=["estado_final"])
        return {"status": "expirada"}

    if accion == "rechazar":
        log_reasignacion.estado_final = "rechazada"
        log_reasignacion.save(update_fields=["estado_final"])

        if (
            log_reasignacion.turno_ofrecido
            and log_reasignacion.turno_ofrecido.estado == "oferta_enviada"
        ):
            turno_ofrecido = log_reasignacion.turno_ofrecido
            turno_ofrecido.estado = "confirmado"
            _save_turno_with_history(
                turno_ofrecido,
                "Oferta rechazada por cliente",
                update_fields=["estado", "updated_at"],
            )

        iniciar_reasignacion_turno(log_reasignacion.turno_cancelado_id)
        return {"status": "rechazada"}

    if accion != "aceptar":
        return {"status": "accion_invalida"}

    turno_cancelado = log_reasignacion.turno_cancelado
    turno_ofrecido = log_reasignacion.turno_ofrecido

    if not turno_ofrecido:
        return {"status": "turno_ofrecido_no_disponible"}

    if not _slot_libre(turno_cancelado):
        return {"status": "hueco_no_disponible"}

    with transaction.atomic():
        log_reasignacion = (
            LogReasignacion.objects.select_for_update()
            .select_related("turno_cancelado", "turno_ofrecido")
            .get(pk=log_reasignacion.pk)
        )

        if log_reasignacion.estado_final:
            return {
                "status": "ya_resuelta",
                "estado": log_reasignacion.estado_final,
            }

        if not _slot_libre(log_reasignacion.turno_cancelado):
            return {"status": "hueco_no_disponible"}

        if log_reasignacion.turno_ofrecido.estado != "oferta_enviada":
            return {"status": "turno_ofrecido_no_disponible"}

        descuento = Decimal(log_reasignacion.monto_descuento or 0)
        senia_pagada = Decimal(turno_ofrecido.senia_pagada or 0)
        precio_total = Decimal(turno_cancelado.servicio.precio)
        monto_final = _calcular_monto_final(precio_total, descuento, senia_pagada)

        turno_cancelado.cliente_id = turno_ofrecido.cliente_id
        turno_cancelado.estado = "confirmado"
        turno_cancelado.precio_final = monto_final
        turno_cancelado.senia_pagada = senia_pagada
        turno_cancelado.notas_cliente = turno_ofrecido.notas_cliente
        _save_turno_with_history(
            turno_cancelado,
            "Oferta aceptada, turno reasignado",
            update_fields=[
                "cliente",
                "estado",
                "precio_final",
                "senia_pagada",
                "notas_cliente",
                "updated_at",
            ],
        )

        turno_ofrecido.estado = "cancelado"
        _save_turno_with_history(
            turno_ofrecido,
            "Oferta aceptada, turno ofrecido cancelado",
            update_fields=["estado", "updated_at"],
        )

        log_reasignacion.estado_final = "aceptada"
        log_reasignacion.save(update_fields=["estado_final"])

    return {"status": "aceptada", "turno_id": turno_cancelado.pk}
