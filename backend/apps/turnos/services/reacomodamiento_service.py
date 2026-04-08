"""Compatibilidad para Proceso 2 usando el flujo moderno de reasignacion."""

import logging

from apps.turnos.models import LogReasignacion
from apps.turnos.services.reasignacion_service import iniciar_reasignacion_turno

logger = logging.getLogger(__name__)


def iniciar_reacomodamiento(turno_cancelado_id: int) -> dict:
    """Mantiene API vieja, pero delega al servicio nuevo basado en token."""
    resultado = iniciar_reasignacion_turno(turno_cancelado_id)
    status_nuevo = resultado.get("status")

    if status_nuevo == "oferta_enviada":
        turno_id = None
        log_id = resultado.get("log_id")
        if log_id:
            log = (
                LogReasignacion.objects.filter(id=log_id)
                .only("turno_ofrecido_id")
                .first()
            )
            turno_id = log.turno_ofrecido_id if log else None

        return {"status": "propuesta_enviada", "turno_id": turno_id, "log_id": log_id}

    status_map = {
        "hueco_no_disponible": "sin_candidatos",
    }
    return {"status": status_map.get(status_nuevo, status_nuevo)}
