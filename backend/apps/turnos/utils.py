from django.contrib.auth import get_user_model
from django.db import transaction
from simple_history.utils import update_change_reason

from .models import Turno

SYSTEM_HISTORY_EMAIL = "system@local"
SYSTEM_HISTORY_USERNAME = "system"
SYSTEM_HISTORY_FIRST_NAME = "System"
SYSTEM_HISTORY_LAST_NAME = "Process"


def get_system_history_user():
    User = get_user_model()
    user, _ = User.objects.get_or_create(
        email=SYSTEM_HISTORY_EMAIL,
        defaults={
            "username": SYSTEM_HISTORY_USERNAME,
            "first_name": SYSTEM_HISTORY_FIRST_NAME,
            "last_name": SYSTEM_HISTORY_LAST_NAME,
            "is_active": False,
        },
    )
    return user


def restaurar_turno_desde_historial(history_id, history_user=None):
    """
    Restaura un turno a una versión anterior desde el historial.

    Args:
        history_id: ID del registro histórico
        history_user: Usuario que realiza la restauración (opcional)

    Returns:
        Turno restaurado
    """
    history_record = Turno.history.select_related("history_user").get(
        history_id=history_id
    )

    # Obtener el turno actual
    turno_actual = Turno.objects.get(pk=history_record.id)

    # Restaurar los campos del historial
    turno_actual.cliente_id = history_record.cliente_id
    turno_actual.empleado_id = history_record.empleado_id
    turno_actual.servicio_id = history_record.servicio_id
    turno_actual.fecha_hora = history_record.fecha_hora
    turno_actual.estado = history_record.estado
    turno_actual.notas_cliente = history_record.notas_cliente
    turno_actual.notas_empleado = history_record.notas_empleado
    turno_actual.precio_final = history_record.precio_final
    turno_actual.senia_pagada = history_record.senia_pagada
    turno_actual.fecha_hora_completado = history_record.fecha_hora_completado

    if history_user is None:
        history_user = get_system_history_user()

    turno_actual._history_user = history_user
    update_change_reason(turno_actual, f"Restaurado desde historial #{history_id}")

    with transaction.atomic():
        turno_actual.save()

    return turno_actual
