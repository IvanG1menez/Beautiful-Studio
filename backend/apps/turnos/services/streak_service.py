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
    StreakCoupon,
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

    goal_count = int(getattr(config, "streak_goal_count", 5) or 5)
    if new_count % max(1, goal_count) != 0:
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

    coupon = StreakCoupon.objects.select_for_update().filter(reward_event=reward).first()
    previous_coupon_status = coupon.status if coupon else None
    if coupon and coupon.status in {"pendiente", "reclamado"}:
        coupon.status = "cancelado"
        coupon.save(update_fields=["status", "updated_at"])

    previous_status = reward.status
    reward.status = "revertido"
    reward.valor_anterior = {
        "status": previous_status,
        "coupon_status": previous_coupon_status,
    }
    reward.valor_posterior = {
        "status": "revertido",
        "coupon_status": coupon.status if coupon else None,
    }
    reward.save(update_fields=["status", "valor_anterior", "valor_posterior"])

    StreakAuditLog.objects.create(
        cliente=turno.cliente,
        turno=turno,
        actor=actor_user,
        accion="modificacion",
        event_type="streak_bonus",
        valor_anterior={"status": previous_status, "coupon_status": previous_coupon_status},
        valor_posterior={"status": "revertido", "coupon_status": coupon.status if coupon else None},
        detalle="Reversa del cupón PA3 por cancelación",
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
    coupon_expiration_days = int(getattr(config, "streak_coupon_expiration_days", 90) or 90)

    if bonus_amount <= 0:
        status = "saltado_prioridad"
        reason = "PA3 bono configurado en 0"
        coupon = None
    else:
        already_has_coupon = _cliente_has_active_streak_coupon(turno.cliente)
        if already_has_coupon:
            status = "saltado_prioridad"
            reason = "PA3 omitido por cupón activo existente"
            coupon = None
        else:
            status = "aplicado"
            reason = "PA3 cupón pendiente por meta de racha"
            coupon = None

    event = StreakRewardEvent.objects.create(
        cliente=turno.cliente,
        turno=turno,
        milestone_number=streak_after,
        streak_before=streak_before,
        streak_after=streak_after,
        bonus_amount=bonus_amount,
        applied_discount_amount=Decimal("0"),
        status=status,
        reason=reason,
        valor_anterior={
            "streak_count": streak_before,
        },
        valor_posterior={
            "streak_count": streak_after,
            "status": status,
        },
    )

    if status == "aplicado":
        coupon = StreakCoupon.objects.create(
            cliente=turno.cliente,
            reward_event=event,
            milestone_number=streak_after,
            discount_amount=bonus_amount,
            status="pendiente",
            expires_at=timezone.now() + timedelta(days=max(1, coupon_expiration_days)),
        )
        event.valor_posterior = {
            **(event.valor_posterior or {}),
            "coupon_id": coupon.id,
            "coupon_status": coupon.status,
            "discount_amount": str(coupon.discount_amount),
            "expires_at": coupon.expires_at.isoformat() if coupon.expires_at else None,
        }
        event.save(update_fields=["valor_posterior"])

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


def _cliente_has_active_streak_coupon(cliente) -> bool:
    now = timezone.now()
    expired = StreakCoupon.objects.filter(
        cliente=cliente,
        status__in=["pendiente", "reclamado"],
        expires_at__lt=now,
    )
    expired.update(status="vencido", updated_at=now)

    return StreakCoupon.objects.filter(
        cliente=cliente,
        status__in=["pendiente", "reclamado"],
    ).exists()
