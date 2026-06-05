"""Servicio de reasignación automática de turnos tras cancelaciones"""

from decimal import Decimal
import logging
import uuid
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from simple_history.utils import update_change_reason

from apps.turnos.models import Turno, LogReasignacion
from apps.turnos.utils import get_system_history_user
from apps.emails.services import EmailService
from apps.clientes.models import Billetera

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
    """Determina el descuento directo según el tipo de pago del candidato."""

    servicio = turno_cancelado.servicio
    tipo_pago_candidato = turno_candidato.resolver_tipo_pago()

    if tipo_pago_candidato == "SENIA":
        bono = Decimal(str(getattr(servicio, "bono_reacomodamiento_senia", 0) or 0))
        return bono, "BONO_CANDIDATO_SENIA", tipo_pago_candidato

    if tipo_pago_candidato == "PAGO_COMPLETO":
        return (
            Decimal("0.00"),
            "CREDITO_BILLETERA_CANDIDATO_PAGO_COMPLETO",
            tipo_pago_candidato,
        )

    return (
        Decimal("0.00"),
        "SIN_BONO_CANDIDATO_SIN_PAGO",
        tipo_pago_candidato,
    )


def _calcular_credito_billetera_para_candidato(
    turno_cancelado: Turno,
    tipo_pago_candidato: str | None,
) -> Decimal:
    """Crédito de billetera que se acredita solo si acepta un candidato con pago completo."""

    if tipo_pago_candidato != "PAGO_COMPLETO":
        return Decimal("0.00")

    servicio = turno_cancelado.servicio
    credito = Decimal(str(getattr(servicio, "bono_reacomodamiento_pago_completo", 0) or 0))
    return credito.quantize(Decimal("0.01"))


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


def _set_log_audit(log: LogReasignacion, anterior: dict, posterior: dict) -> None:
    log.estado_anterior = anterior
    log.estado_posterior = posterior


def _silenciar_notificaciones_genericas(turno: Turno) -> None:
    turno._skip_generic_notifications = True
    turno._notification_context = "reasignacion"


def _notificar_reacomodamiento_confirmado(
    *,
    turno_nuevo_id: int,
    turno_anterior_id: int,
    descuento: Decimal,
    credito_billetera: Decimal,
) -> None:
    """Notifica el evento de negocio final, evitando mails por estados intermedios."""
    try:
        from apps.emails.models import Notificacion, NotificacionConfig
        from apps.users.models import User

        turno_nuevo = Turno.objects.select_related(
            "cliente__user", "empleado__user", "servicio"
        ).get(pk=turno_nuevo_id)
        turno_anterior = Turno.objects.select_related(
            "cliente__user", "empleado__user", "servicio"
        ).get(pk=turno_anterior_id)

        cliente = turno_nuevo.cliente
        profesional_user = turno_nuevo.empleado.user
        cliente_user = cliente.user
        cliente_nombre = cliente.nombre_completo
        fecha_nueva = timezone.localtime(turno_nuevo.fecha_hora).strftime("%d/%m/%Y %H:%M")

        config_cliente, _ = NotificacionConfig.objects.get_or_create(user=cliente_user)
        if config_cliente.notificar_modificacion_turno:
            Notificacion.objects.create(
                usuario=cliente_user,
                tipo="modificacion_turno",
                titulo="Tu turno fue reacomodado",
                mensaje=f"Tu turno para {turno_nuevo.servicio.nombre} quedó confirmado para el {fecha_nueva}.",
                data={"turno_id": turno_nuevo.id, "contexto": "reasignacion"},
            )

        config_prof, _ = NotificacionConfig.objects.get_or_create(user=profesional_user)
        if config_prof.notificar_modificacion_turno:
            Notificacion.objects.create(
                usuario=profesional_user,
                tipo="modificacion_turno",
                titulo=f"{cliente_nombre} reacomodó su turno",
                mensaje=f"El turno de {cliente_nombre} quedó confirmado para el {fecha_nueva}.",
                data={"turno_id": turno_nuevo.id, "contexto": "reasignacion"},
            )

        hubo_beneficio = descuento > 0 or credito_billetera > 0
        if hubo_beneficio:
            for propietario in User.objects.filter(role="propietario"):
                config_prop, _ = NotificacionConfig.objects.get_or_create(user=propietario)
                if config_prop.notificar_reporte_diario:
                    Notificacion.objects.create(
                        usuario=propietario,
                        tipo="reporte_diario",
                        titulo="Reacomodamiento confirmado",
                        mensaje=f"{cliente_nombre} aceptó reacomodar su turno con beneficio aplicado.",
                        data={"turno_id": turno_nuevo.id, "contexto": "reasignacion"},
                    )

        EmailService.enviar_emails_reacomodamiento_confirmado(
            turno_nuevo=turno_nuevo,
            turno_anterior=turno_anterior,
            monto_descuento=descuento,
            monto_credito_billetera=credito_billetera,
        )
    except Exception as e:
        logger.error("Error notificando reacomodamiento confirmado: %s", str(e))


def _hueco_generado_por_reasignacion(turno: Turno) -> bool:
    return LogReasignacion.objects.filter(turno_ofrecido=turno, estado_final="aceptada").exists()


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
    credito_billetera = _calcular_credito_billetera_para_candidato(
        turno_cancelado, tipo_pago_candidato
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
    _set_log_audit(
        log_reasignacion,
        {"estado_final": None, "turno_ofrecido_estado": candidato.estado},
        {
            "estado_final": None,
            "turno_ofrecido_estado": "oferta_enviada",
            "expires_at": log_reasignacion.expires_at.isoformat(),
        },
    )
    log_reasignacion.save(update_fields=["estado_anterior", "estado_posterior"])

    try:
        from apps.emails.models import PromotionOffer

        PromotionOffer.objects.create(
            campaign_id=uuid.uuid5(uuid.NAMESPACE_URL, f"reacomodamiento:{turno_cancelado.id}"),
            process_type=PromotionOffer.ProcessType.REACOMODAMIENTO,
            cliente=candidato.cliente,
            servicio=turno_cancelado.servicio,
            empleado=turno_cancelado.empleado,
            turno=turno_cancelado,
            reasignacion_log=log_reasignacion,
            fecha_hora=turno_cancelado.fecha_hora,
            beneficio=PromotionOffer.Benefit.DISCOUNT,
            saldo_snapshot=Decimal("0.00"),
            expires_at=log_reasignacion.expires_at,
            metadata={
                "turno_cancelado_id": turno_cancelado.id,
                "turno_ofrecido_id": candidato.id,
                "monto_descuento": str(descuento),
                "monto_final": str(monto_final),
                "credito_billetera": str(credito_billetera),
                "regla_descuento_aplicada": regla_descuento,
                "tipo_pago_cliente_ofertado": tipo_pago_candidato,
            },
        )
    except Exception as exc:
        logger.warning(
            "No se pudo crear PromotionOffer para reasignacion log=%s: %s",
            log_reasignacion.id,
            exc,
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
        monto_credito_billetera=credito_billetera,
    )

    if not enviado:
        logger.error(
            f"No se pudo enviar email de oferta para turno {candidato.id}. Revirtiendo estado."
        )
        try:
            from apps.emails.models import PromotionOffer

            PromotionOffer.objects.filter(reasignacion_log=log_reasignacion).update(
                status=PromotionOffer.Status.CANCELLED
            )
        except Exception:
            pass
        candidato.estado = "confirmado"
        _save_turno_with_history(
            candidato,
            "Reversion de oferta enviada",
            update_fields=["estado"],
        )
        log_reasignacion.estado_final = "rechazada"
        _set_log_audit(
            log_reasignacion,
            {"estado_final": None, "turno_ofrecido_estado": "oferta_enviada"},
            {"estado_final": "rechazada", "turno_ofrecido_estado": "confirmado", "motivo": "email_fallido"},
        )
        log_reasignacion.save(update_fields=["estado_final", "estado_anterior", "estado_posterior"])
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

    cerrar_ciclo = _hueco_generado_por_reasignacion(log_reasignacion.turno_cancelado)
    anterior_log = {
        "estado_final": None,
        "turno_ofrecido_estado": getattr(log_reasignacion.turno_ofrecido, "estado", None),
    }
    log_reasignacion.estado_final = "expirada"

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

    _set_log_audit(
        log_reasignacion,
        anterior_log,
        {
            "estado_final": "expirada",
            "turno_ofrecido_estado": getattr(log_reasignacion.turno_ofrecido, "estado", None),
            "ciclo_cerrado": cerrar_ciclo,
        },
    )
    log_reasignacion.save(update_fields=["estado_final", "estado_anterior", "estado_posterior"])

    # Continuar con siguiente candidato salvo cuando el hueco ya fue generado por una reasignación previa.
    if not cerrar_ciclo:
        iniciar_reasignacion_turno(log_reasignacion.turno_cancelado_id)
    return {"status": "expirada", "ciclo_cerrado": cerrar_ciclo}


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
        cerrar_ciclo = _hueco_generado_por_reasignacion(log_reasignacion.turno_cancelado)
        anterior_log = {
            "estado_final": None,
            "turno_ofrecido_estado": getattr(log_reasignacion.turno_ofrecido, "estado", None),
        }
        log_reasignacion.estado_final = "expirada"

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

        _set_log_audit(
            log_reasignacion,
            anterior_log,
            {
                "estado_final": "expirada",
                "turno_ofrecido_estado": getattr(log_reasignacion.turno_ofrecido, "estado", None),
                "ciclo_cerrado": cerrar_ciclo,
            },
        )
        log_reasignacion.save(update_fields=["estado_final", "estado_anterior", "estado_posterior"])

        # Fallback cuando no corrio Celery de expiracion: continuar cadena ahora.
        if not cerrar_ciclo:
            iniciar_reasignacion_turno(log_reasignacion.turno_cancelado_id)
        return {
            "status": "expirada",
            "mensaje": "Lo sentimos, tu tiempo se acabo para responder esta oferta.",
            "ciclo_cerrado": cerrar_ciclo,
        }

    turno_cancelado = log_reasignacion.turno_cancelado
    turno_ofrecido = log_reasignacion.turno_ofrecido

    if accion == "rechazar":
        cerrar_ciclo = _hueco_generado_por_reasignacion(log_reasignacion.turno_cancelado)
        anterior_log = {
            "estado_final": None,
            "turno_ofrecido_estado": getattr(log_reasignacion.turno_ofrecido, "estado", None),
        }
        log_reasignacion.estado_final = "rechazada"

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

        _set_log_audit(
            log_reasignacion,
            anterior_log,
            {
                "estado_final": "rechazada",
                "turno_ofrecido_estado": getattr(log_reasignacion.turno_ofrecido, "estado", None),
                "ciclo_cerrado": cerrar_ciclo,
            },
        )
        log_reasignacion.save(update_fields=["estado_final", "estado_anterior", "estado_posterior"])

        if not cerrar_ciclo:
            iniciar_reasignacion_turno(log_reasignacion.turno_cancelado_id)
        return {"status": "rechazada", "ciclo_cerrado": cerrar_ciclo}

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
        tipo_pago_candidato = log_reasignacion.tipo_pago_cliente_ofertado
        credito_billetera = _calcular_credito_billetera_para_candidato(
            turno_cancelado, tipo_pago_candidato
        )

        turno_cancelado.cliente_id = turno_ofrecido.cliente_id
        turno_cancelado.estado = "confirmado"
        turno_cancelado.senia_pagada = turno_ofrecido.senia_pagada
        turno_cancelado.tipo_pago = turno_ofrecido.tipo_pago
        turno_cancelado.metodo_pago = turno_ofrecido.metodo_pago
        turno_cancelado.precio_final = turno_ofrecido.precio_final or turno_cancelado.servicio.precio
        turno_cancelado.canal_reserva = turno_ofrecido.canal_reserva
        _silenciar_notificaciones_genericas(turno_cancelado)
        _save_turno_with_history(
            turno_cancelado,
            "Oferta de reasignacion aceptada",
            update_fields=[
                "cliente_id",
                "estado",
                "senia_pagada",
                "tipo_pago",
                "metodo_pago",
                "precio_final",
                "canal_reserva",
            ],
        )

        if credito_billetera > 0:
            billetera, _ = Billetera.objects.get_or_create(
                cliente=turno_ofrecido.cliente,
                defaults={"saldo": Decimal("0.00")},
            )
            billetera.agregar_saldo(
                monto=credito_billetera,
                motivo=(
                    f"Crédito por aceptar reacomodamiento del turno #{turno_cancelado.id} - "
                    f"{turno_cancelado.servicio.nombre}"
                ),
            )
            movimiento = billetera.movimientos.first()
            if movimiento:
                movimiento.turno = turno_cancelado
                movimiento.save(update_fields=["turno"])

        turno_ofrecido.estado = "cancelado"
        _silenciar_notificaciones_genericas(turno_ofrecido)
        _save_turno_with_history(
            turno_ofrecido,
            "Turno cancelado por reasignacion",
            update_fields=["estado"],
        )

        log_reasignacion.estado_final = "aceptada"
        _set_log_audit(
            log_reasignacion,
            {"estado_final": None, "turno_cancelado_estado": "cancelado", "turno_ofrecido_estado": "oferta_enviada"},
            {
                "estado_final": "aceptada",
                "turno_cancelado_estado": turno_cancelado.estado,
                "turno_ofrecido_estado": turno_ofrecido.estado,
                "cliente_asignado_turno_cancelado_id": turno_cancelado.cliente_id,
            },
        )
        log_reasignacion.save(update_fields=["estado_final", "estado_anterior", "estado_posterior"])

        transaction.on_commit(
            lambda: _notificar_reacomodamiento_confirmado(
                turno_nuevo_id=turno_cancelado.pk,
                turno_anterior_id=turno_ofrecido.pk,
                descuento=descuento,
                credito_billetera=credito_billetera,
            )
        )

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
    credito_billetera = _calcular_credito_billetera_para_candidato(
        turno_cancelado,
        log_reasignacion.tipo_pago_cliente_ofertado,
    )

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
            "credito_billetera": str(credito_billetera),
        },
        "ahorro": {
            "dias_adelantados": (
                turno_ofrecido.fecha_hora - turno_cancelado.fecha_hora
            ).days,
            "descuento_aplicado": str(descuento),
        },
    }
