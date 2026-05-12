"""Lógica de dominio para PA3 (fidelización por rachas)."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.authentication.models import ConfiguracionGlobal
from apps.turnos.models import (
    ClienteStreakStats,
    StreakAuditLog,
    StreakRewardEvent,
    Turno,
)


def process_turno_state_transition(
    turno: Turno,
    previous_state: str | None,
    actor_user=None,
) -> None:
    """Procesa PA3 cuando cambia el estado de un turno.

    Reglas:
    - Incrementa al pasar a `completado`.
    - Decrementa al pasar de `completado` a `cancelado`.
    """

    current_state = turno.estado

    if previous_state != "completado" and current_state == "completado":
        _apply_completion(turno, actor_user=actor_user)

    if previous_state == "completado" and current_state == "cancelado":
        _apply_completion_reversal(turno, actor_user=actor_user)


@transaction.atomic
def _apply_completion(turno: Turno, actor_user=None) -> None:
    now = turno.fecha_hora_completado or timezone.now()
    config = ConfiguracionGlobal.get_config()

    stats, created = ClienteStreakStats.objects.select_for_update().get_or_create(
        cliente=turno.cliente,
        defaults={
            "streak_count": 0,
            "last_completed_turno": None,
            "last_completed_at": None,
            "next_expiration_at": None,
        },
    )

    previous_count = int(stats.streak_count or 0)
    previous_completed_at = stats.last_completed_at

    expiration_days = int(getattr(config, "streak_expiration_days", 180) or 180)
    expires_delta = timedelta(days=max(1, expiration_days))

    if previous_completed_at and now - previous_completed_at > expires_delta:
        new_count = 1
        counter_reason = "PA3 reset por inactividad"
    else:
        new_count = previous_count + 1
        counter_reason = "PA3 incremento por turno completado"

    stats.streak_count = new_count
    stats.last_completed_turno = turno
    stats.last_completed_at = now
    stats.next_expiration_at = now + expires_delta

    stats.save()

    StreakAuditLog.objects.create(
        cliente=turno.cliente,
        turno=turno,
        actor=actor_user,
        accion="insercion" if created else "modificacion",
        event_type="streak_counter",
        valor_anterior={
            "streak_count": previous_count,
            "last_completed_at": (
                previous_completed_at.isoformat() if previous_completed_at else None
            ),
        },
        valor_posterior={
            "streak_count": new_count,
            "last_completed_at": now.isoformat(),
            "next_expiration_at": stats.next_expiration_at.isoformat(),
        },
        detalle=counter_reason,
    )

    if new_count % 5 != 0:
        return

    _create_or_apply_milestone_reward(
        turno=turno,
        streak_before=previous_count,
        streak_after=new_count,
        actor_user=actor_user,
    )


@transaction.atomic
def _apply_completion_reversal(turno: Turno, actor_user=None) -> None:
    try:
        stats = ClienteStreakStats.objects.select_for_update().get(cliente=turno.cliente)
    except ClienteStreakStats.DoesNotExist:
        return

    previous_count = int(stats.streak_count or 0)
    new_count = max(0, previous_count - 1)

    last_completed = (
        Turno.objects.filter(cliente=turno.cliente, estado="completado")
        .order_by("-fecha_hora_completado", "-fecha_hora")
        .first()
    )

    config = ConfiguracionGlobal.get_config()
    expiration_days = int(getattr(config, "streak_expiration_days", 180) or 180)
    expires_delta = timedelta(days=max(1, expiration_days))

    stats.streak_count = new_count
    stats.last_completed_turno = last_completed
    stats.last_completed_at = (
        (last_completed.fecha_hora_completado or last_completed.fecha_hora)
        if last_completed
        else None
    )
    stats.next_expiration_at = (
        stats.last_completed_at + expires_delta if stats.last_completed_at else None
    )

    stats.save()

    StreakAuditLog.objects.create(
        cliente=turno.cliente,
        turno=turno,
        actor=actor_user,
        accion="modificacion",
        event_type="streak_counter",
        valor_anterior={"streak_count": previous_count},
        valor_posterior={"streak_count": new_count},
        detalle="Reversa de racha por cambio a cancelado",
    )

    reward = (
        StreakRewardEvent.objects.select_for_update()
        .filter(turno=turno, status="aplicado")
        .order_by("-id")
        .first()
    )
    if not reward:
        return

    old_price = Decimal(str(turno.precio_final or 0))
    restored_price = old_price + Decimal(str(reward.applied_discount_amount or 0))
    service_price = Decimal(str(turno.servicio.precio or restored_price))
    turno.precio_final = min(restored_price, service_price)
    turno.save(update_fields=["precio_final"])

    previous_status = reward.status
    reward.status = "revertido"
    reward.valor_anterior = {
        "status": previous_status,
        "turno_precio_final": str(old_price),
    }
    reward.valor_posterior = {
        "status": "revertido",
        "turno_precio_final": str(turno.precio_final),
    }
    reward.save(update_fields=["status", "valor_anterior", "valor_posterior"])

    StreakAuditLog.objects.create(
        cliente=turno.cliente,
        turno=turno,
        actor=actor_user,
        accion="modificacion",
        event_type="streak_bonus",
        valor_anterior={"status": previous_status, "precio_final": str(old_price)},
        valor_posterior={"status": "revertido", "precio_final": str(turno.precio_final)},
        detalle="Reversa del bono PA3 por cancelación",
    )


@transaction.atomic
def _create_or_apply_milestone_reward(
    turno: Turno,
    streak_before: int,
    streak_after: int,
    actor_user=None,
) -> None:
    config = ConfiguracionGlobal.get_config()
    bonus_amount = Decimal(str(getattr(config, "streak_bonus_amount", 0) or 0))

    if bonus_amount <= 0:
        status = "saltado_prioridad"
        reason = "PA3 bono configurado en 0"
        applied_discount = Decimal("0")
    else:
        already_has_bonus = _turno_has_existing_bonus(turno)
        if already_has_bonus:
            status = "saltado_prioridad"
            reason = "PA3 omitido por prioridad de bono existente"
            applied_discount = Decimal("0")
        else:
            status = "aplicado"
            reason = "PA3 aplicado por múltiplo de 5"
            base_price = Decimal(str(turno.precio_final or turno.servicio.precio or 0))
            new_price = max(Decimal("0"), base_price - bonus_amount)
            turno.precio_final = new_price
            turno.save(update_fields=["precio_final"])
            applied_discount = min(bonus_amount, base_price)

    event = StreakRewardEvent.objects.create(
        cliente=turno.cliente,
        turno=turno,
        milestone_number=streak_after,
        streak_before=streak_before,
        streak_after=streak_after,
        bonus_amount=bonus_amount,
        applied_discount_amount=applied_discount,
        status=status,
        reason=reason,
        valor_anterior={
            "precio_final": str(turno.servicio.precio if turno.servicio else 0),
            "streak_count": streak_before,
        },
        valor_posterior={
            "precio_final": str(turno.precio_final or 0),
            "streak_count": streak_after,
            "status": status,
        },
    )

    StreakAuditLog.objects.create(
        cliente=turno.cliente,
        turno=turno,
        actor=actor_user,
        accion="insercion",
        event_type="streak_bonus",
        valor_anterior=event.valor_anterior,
        valor_posterior=event.valor_posterior,
        detalle=reason,
    )


def _turno_has_existing_bonus(turno: Turno) -> bool:
    service_price = Decimal(str(turno.servicio.precio or 0))
    final_price = Decimal(str(turno.precio_final if turno.precio_final is not None else service_price))

    if service_price > Decimal("0") and final_price < service_price:
        return True

    # Proceso 2: detectar un descuento ya aplicado por reacomodamiento.
    return turno.reasignaciones_cancelado.filter(
        estado_final="aceptada",
        monto_descuento__gt=0,
    ).exists()
