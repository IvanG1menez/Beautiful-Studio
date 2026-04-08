"""Servicio de reasignación automática de turnos tras cancelaciones"""

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


def _cancelacion_en_termino(turno_cancelado: Turno) -> bool:
    """True si la cancelación ocurrió con al menos el mínimo de horas requerido."""

    from apps.authentication.models import ConfiguracionGlobal

    config_global = ConfiguracionGlobal.get_config()
    min_horas_credito_global = config_global.min_horas_cancelacion_credito
    min_horas_credito_servicio = max(
        24,
        int(
            getattr(turno_cancelado.servicio, "horas_minimas_credito_cancelacion", 24)
            or 24
        ),
    )
    min_horas_credito = max(min_horas_credito_global, min_horas_credito_servicio)

    horas_diferencia = (
        turno_cancelado.fecha_hora - timezone.now()
    ).total_seconds() / 3600
    return horas_diferencia >= min_horas_credito


def _calcular_descuento_para_candidato(
    turno_cancelado: Turno, turno_candidato: Turno
) -> tuple[Decimal, str, str]:
    """Determina descuento y regla según ventana de cancelación y tipo de pago.

    Reglas:
    - Cancelación en término (>= mínimo): adelanto SIN descuento adicional.
        - Cancelación fuera de término: bono SOLO para clientes con seña.
            * candidato con seña => bono_reacomodamiento_senia
            * candidato con pago completo => sin descuento promocional
            * sin pago => sin descuento
    """

    servicio = turno_cancelado.servicio

    if _cancelacion_en_termino(turno_cancelado):
        return Decimal("0.00"), "CANCELACION_EN_TERMINO_SIN_DESCUENTO", "SIN_DESCUENTO"

    tipo_pago_candidato = turno_candidato.resolver_tipo_pago()
    if tipo_pago_candidato == "SENIA":
        bono = Decimal(str(getattr(servicio, "bono_reacomodamiento_senia", 0) or 0))
        return bono, "FUERA_DE_TERMINO_BONO_SENIA", tipo_pago_candidato

    if tipo_pago_candidato == "PAGO_COMPLETO":
        return (
            Decimal("0.00"),
            "FUERA_DE_TERMINO_PAGO_COMPLETO_SIN_PROMO",
            tipo_pago_candidato,
        )

    return (
        Decimal("0.00"),
        "FUERA_DE_TERMINO_SIN_PAGO_SIN_DESCUENTO",
        tipo_pago_candidato,
    )


def _save_turno_with_history(turno: Turno, reason: str, update_fields=None) -> None:
    """Guarda el turno y registra el motivo del cambio en el historial"""
    try:
        update_change_reason(turno, reason)
    except Exception:
        # Fallback compatible con entornos donde simple_history no puede
        # adjuntar el motivo previo al save (evita cortar el flujo).
        turno._change_reason = reason
    if update_fields:
        turno.save(update_fields=update_fields)
    else:
        turno.save()


def _slot_libre(turno_cancelado: Turno) -> bool:
    """Valida que el hueco siga libre antes de enviar o aceptar una oferta."""
    return not Turno.objects.filter(
        empleado=turno_cancelado.empleado,
        fecha_hora=turno_cancelado.fecha_hora,
        estado__in=ESTADOS_ACTIVOS,
    ).exists()


def _calcular_monto_final(
    precio_total: Decimal, descuento: Decimal, senia: Decimal
) -> Decimal:
    """Wrapper interno que usa la lógica de Turno.calcular_pago_final.

    Se mantiene como helper local para no cambiar todas las firmas,
    pero delega el cálculo real al modelo de dominio.
    """

    return Turno.calcular_pago_final(precio_total, descuento, senia)


def iniciar_reasignacion_turno(turno_cancelado_id: int) -> dict:
    """Selecciona un candidato y envía la oferta de reasignación."""
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

    clientes_ya_notificados = list(
        LogReasignacion.objects.filter(turno_cancelado=turno_cancelado).values_list(
            "cliente_notificado_id", flat=True
        )
    )

    candidato = (
        Turno.objects.filter(
            servicio=turno_cancelado.servicio,
            empleado=turno_cancelado.empleado,
            estado="confirmado",
            fecha_hora__gt=turno_cancelado.fecha_hora,
        )
        .exclude(cliente_id__in=clientes_ya_notificados)
        .select_related("cliente__user", "servicio")
        .order_by("-fecha_hora")
        .first()
    )

    if not candidato:
        return {"status": "sin_candidatos"}

    servicio = turno_cancelado.servicio

    # Calcular descuento según reglas de negocio de Proceso 2.
    # Si la cancelación fue en término, el adelanto se ofrece sin bono.
    # Si fue fuera de término, el bono depende del tipo de pago del candidato.
    precio_total = Decimal(servicio.precio)
    descuento, regla_descuento, tipo_pago_candidato = (
        _calcular_descuento_para_candidato(turno_cancelado, candidato)
    )

    senia_pagada = Decimal(candidato.senia_pagada or 0)
    monto_final = _calcular_monto_final(precio_total, descuento, senia_pagada)

    # Tiempo de espera configurable por servicio (en minutos)
    tiempo_espera_min = getattr(servicio, "tiempo_espera_respuesta", 15) or 15

    log_reasignacion = LogReasignacion.objects.create(
        turno_cancelado=turno_cancelado,
        turno_ofrecido=candidato,
        cliente_notificado=candidato.cliente,
        monto_descuento=descuento,
        tipo_pago_cliente_ofertado=tipo_pago_candidato,
        regla_descuento_aplicada=regla_descuento,
        expires_at=timezone.now() + timedelta(minutes=tiempo_espera_min),
    )

    candidato.estado = "oferta_enviada"
    _save_turno_with_history(
        candidato,
        "Oferta enviada por reasignacion",
        update_fields=["estado"],
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
            update_fields=["estado"],
        )
        log_reasignacion.estado_final = "rechazada"
        log_reasignacion.save(update_fields=["estado_final"])
        return {"status": "email_fallido"}

    # Encolar tarea de expiración automática (si Celery está disponible)
    try:
        from apps.turnos.tasks import expirar_oferta_reasignacion

        expirar_oferta_reasignacion.apply_async(
            args=[log_reasignacion.id], countdown=tiempo_espera_min * 60
        )
        logger.info(f"Tarea de expiración encolada para log {log_reasignacion.id}")
    except Exception as e:  # pragma: no cover - fallo opcional de Celery
        logger.warning(
            f"No se pudo encolar tarea de expiración (Celery no disponible): {e}"
        )
        logger.info("La oferta seguirá válida pero no expirará automáticamente")

    return {"status": "oferta_enviada", "log_id": log_reasignacion.id}


def expirar_oferta_reasignacion(log_id: int) -> dict:
    """Marca la oferta como expirada y continúa con el siguiente candidato."""
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
        turno_ofrecido.estado = "confirmado"
        _save_turno_with_history(
            turno_ofrecido,
            "Oferta expirada (no respondida a tiempo)",
            update_fields=["estado"],
        )

    # Continuar con siguiente candidato
    iniciar_reasignacion_turno(log_reasignacion.turno_cancelado_id)
    return {"status": "expirada"}


def responder_oferta_reasignacion(token: str, accion: str) -> dict:
    """Procesa la respuesta del cliente a una oferta de reasignación."""
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

        # Si la oferta seguia marcada como enviada, se revierte a confirmado
        # y se intenta continuar con el siguiente candidato.
        if (
            log_reasignacion.turno_ofrecido
            and log_reasignacion.turno_ofrecido.estado == "oferta_enviada"
        ):
            turno_ofrecido = log_reasignacion.turno_ofrecido
            turno_ofrecido.estado = "confirmado"
            _save_turno_with_history(
                turno_ofrecido,
                "Oferta expirada (respuesta fuera de tiempo)",
                update_fields=["estado"],
            )

        # Fallback cuando no corrio Celery de expiracion: continuar cadena ahora.
        iniciar_reasignacion_turno(log_reasignacion.turno_cancelado_id)
        return {
            "status": "expirada",
            "mensaje": "Lo sentimos, tu tiempo se acabo para responder esta oferta.",
        }

    turno_cancelado = log_reasignacion.turno_cancelado
    turno_ofrecido = log_reasignacion.turno_ofrecido

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
                update_fields=["estado"],
            )

        iniciar_reasignacion_turno(log_reasignacion.turno_cancelado_id)
        return {"status": "rechazada"}

    if accion != "aceptar":
        return {"status": "accion_invalida"}

    if not turno_ofrecido:
        return {"status": "turno_ofrecido_no_disponible"}

    if not _slot_libre(turno_cancelado):
        return {"status": "hueco_no_disponible"}

    with transaction.atomic():
        log_reasignacion = LogReasignacion.objects.select_for_update(of=("self",)).get(
            pk=log_reasignacion.pk
        )

        if log_reasignacion.estado_final:
            return {
                "status": "ya_resuelta",
                "estado": log_reasignacion.estado_final,
            }

        if not _slot_libre(turno_cancelado):
            return {"status": "hueco_no_disponible"}

        if turno_ofrecido.estado != "oferta_enviada":
            return {"status": "turno_ofrecido_no_disponible"}

        descuento = Decimal(log_reasignacion.monto_descuento or 0)
        senia_pagada = Decimal(turno_ofrecido.senia_pagada or 0)
        precio_total = Decimal(turno_cancelado.servicio.precio)
        monto_final = _calcular_monto_final(precio_total, descuento, senia_pagada)

        turno_cancelado.cliente_id = turno_ofrecido.cliente_id
        turno_cancelado.estado = "confirmado"
        _save_turno_with_history(
            turno_cancelado,
            "Oferta de reasignacion aceptada",
            update_fields=["cliente_id", "estado"],
        )

        turno_ofrecido.estado = "cancelado"
        _save_turno_with_history(
            turno_ofrecido,
            "Turno cancelado por reasignacion",
            update_fields=["estado"],
        )

        log_reasignacion.estado_final = "aceptada"
        log_reasignacion.save(update_fields=["estado_final"])

    return {"status": "aceptada", "turno_id": turno_cancelado.pk}


def obtener_detalles_oferta_reasignacion(token: str) -> dict:
    """Obtiene detalles de una oferta para mostrar al cliente."""
    try:
        log_reasignacion = LogReasignacion.objects.select_related(
            "turno_cancelado",
            "turno_cancelado__servicio",
            "turno_cancelado__empleado__user",
            "turno_ofrecido",
            "turno_ofrecido__servicio",
            "turno_ofrecido__empleado__user",
            "cliente_notificado__user",
        ).get(token=token)
    except LogReasignacion.DoesNotExist:
        return {"status": "token_invalido", "error": "Token no válido o expirado"}

    if log_reasignacion.estado_final:
        return {
            "status": "ya_resuelta",
            "estado": log_reasignacion.estado_final,
            "mensaje": f"Esta oferta ya fue {log_reasignacion.estado_final}",
        }

    if log_reasignacion.expires_at <= timezone.now():
        return {
            "status": "expirada",
            "mensaje": "Esta oferta ha expirado",
        }

    turno_cancelado = log_reasignacion.turno_cancelado
    turno_ofrecido = log_reasignacion.turno_ofrecido

    descuento = Decimal(log_reasignacion.monto_descuento or 0)
    senia_pagada = Decimal(turno_ofrecido.senia_pagada or 0)
    precio_total = Decimal(turno_cancelado.servicio.precio)
    monto_final = _calcular_monto_final(precio_total, descuento, senia_pagada)

    return {
        "status": "activa",
        "token": str(log_reasignacion.token),
        "expires_at": log_reasignacion.expires_at.isoformat(),
        "regla_descuento_aplicada": log_reasignacion.regla_descuento_aplicada,
        "tipo_pago_cliente_ofertado": log_reasignacion.tipo_pago_cliente_ofertado,
        "cliente": {
            "nombre": log_reasignacion.cliente_notificado.nombre_completo,
            "email": log_reasignacion.cliente_notificado.user.email,
        },
        "turno_original": {
            "id": turno_ofrecido.id,
            "servicio": turno_ofrecido.servicio.nombre,
            "fecha_hora": turno_ofrecido.fecha_hora.isoformat(),
            "empleado": turno_ofrecido.empleado.nombre_completo,
            "precio": str(turno_ofrecido.servicio.precio),
            "senia_pagada": str(senia_pagada),
        },
        "turno_nuevo": {
            "id": turno_cancelado.id,
            "servicio": turno_cancelado.servicio.nombre,
            "fecha_hora": turno_cancelado.fecha_hora.isoformat(),
            "empleado": turno_cancelado.empleado.nombre_completo,
            "precio_total": str(precio_total),
            "descuento": str(descuento),
            "monto_final": str(monto_final),
        },
        "ahorro": {
            "dias_adelantados": (
                turno_ofrecido.fecha_hora - turno_cancelado.fecha_hora
            ).days,
            "descuento_aplicado": str(descuento),
        },
    }
