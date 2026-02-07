"""
Tareas asíncronas para reasignación automática de turnos
"""

from celery import shared_task
import logging

from apps.turnos.services.reasignacion_service import (
    iniciar_reasignacion_turno as iniciar_reasignacion_turno_service,
    expirar_oferta_reasignacion as expirar_oferta_reasignacion_service,
)
from apps.turnos.services.reacomodamiento_service import (
    iniciar_reacomodamiento as iniciar_reacomodamiento_service,
)

logger = logging.getLogger(__name__)


@shared_task(name="apps.turnos.tasks.iniciar_reasignacion_turno")
def iniciar_reasignacion_turno(turno_cancelado_id: int):
    return iniciar_reasignacion_turno_service(turno_cancelado_id)


@shared_task(name="apps.turnos.tasks.expirar_oferta_reasignacion")
def expirar_oferta_reasignacion(log_id: int):
    return expirar_oferta_reasignacion_service(log_id)


@shared_task(name="apps.turnos.tasks.iniciar_reacomodamiento_proceso_2")
def iniciar_reacomodamiento_proceso_2(turno_cancelado_id: int):
    return iniciar_reacomodamiento_service(turno_cancelado_id)
