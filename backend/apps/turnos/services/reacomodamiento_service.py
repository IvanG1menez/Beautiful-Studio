"""
Servicio para el proceso de reacomodamiento (Proceso 2)
"""

import logging

from django.utils import timezone

from apps.turnos.models import Turno
from apps.servicios.utils import enviar_propuesta_reacomodamiento

logger = logging.getLogger(__name__)


ESTADOS_CANDIDATOS = ["pendiente", "confirmado"]


def iniciar_reacomodamiento(turno_cancelado_id: int) -> dict:
    try:
        turno_cancelado = Turno.objects.select_related("servicio").get(
            id=turno_cancelado_id
        )
    except Turno.DoesNotExist:
        logger.warning(f"Turno cancelado {turno_cancelado_id} no existe")
        return {"status": "turno_no_encontrado"}

    if turno_cancelado.estado != "cancelado":
        return {"status": "turno_no_cancelado"}

    if (
        not turno_cancelado.servicio
        or not turno_cancelado.servicio.permite_reacomodamiento
    ):
        return {"status": "servicio_sin_reacomodamiento"}

    if turno_cancelado.fecha_hora and turno_cancelado.fecha_hora <= timezone.now():
        return {"status": "turno_fuera_de_ventana"}

    candidato = (
        Turno.objects.filter(
            servicio=turno_cancelado.servicio,
            estado__in=ESTADOS_CANDIDATOS,
            fecha_hora__gt=turno_cancelado.fecha_hora,
        )
        .select_related("cliente__user", "servicio")
        .order_by("-fecha_hora")
        .first()
    )

    if not candidato:
        return {"status": "sin_candidatos"}

    enviado = enviar_propuesta_reacomodamiento(
        turno_candidato=candidato, servicio=turno_cancelado.servicio
    )

    if not enviado:
        return {"status": "email_fallido"}

    logger.info(f"Propuesta de reacomodamiento enviada al turno {candidato.id}")
    return {"status": "propuesta_enviada", "turno_id": candidato.id}
