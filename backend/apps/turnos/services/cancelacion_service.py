"""Servicios de cancelacion de turnos reutilizables."""

from dataclasses import dataclass
from decimal import Decimal

from django.utils import timezone

from apps.authentication.models import ConfiguracionGlobal
from apps.clientes.models import Billetera
from apps.turnos.models import HistorialTurno


@dataclass
class CancelacionTurnoResult:
    credito_aplicado: bool
    monto_credito: float
    horas_antelacion_requerida: int


def cancelar_turno_para_cliente(turno, usuario, motivo):
    """Cancela un turno y aplica credito si corresponde segun reglas vigentes."""
    motivo = (motivo or "").strip()
    if not motivo:
        raise ValueError("Debes indicar un motivo de cancelacion.")

    if not turno.puede_cancelar():
        raise ValueError("Este turno no puede ser cancelado.")

    estado_anterior = turno.estado

    config_global = ConfiguracionGlobal.get_config()
    min_horas_credito_global = config_global.min_horas_cancelacion_credito
    min_horas_credito_servicio = max(
        24,
        int(getattr(turno.servicio, "horas_minimas_credito_cancelacion", 24) or 24),
    )
    min_horas_credito = max(min_horas_credito_global, min_horas_credito_servicio)

    horas_diferencia = (turno.fecha_hora - timezone.now()).total_seconds() / 3600
    credito_aplicado = False
    monto_credito_valor = Decimal("0.00")

    if horas_diferencia >= min_horas_credito and turno.cliente:
        billetera, _ = Billetera.objects.get_or_create(
            cliente=turno.cliente, defaults={"saldo": Decimal("0.00")}
        )

        precio_base = Decimal(turno.precio_final or turno.servicio.precio or 0)
        senia_pagada = Decimal(turno.senia_pagada or 0)
        pago_completo = turno.resolver_tipo_pago() == "PAGO_COMPLETO"

        monto_credito = precio_base if pago_completo else senia_pagada
        monto_credito = monto_credito.quantize(Decimal("0.01"))

        if monto_credito > 0:
            billetera.agregar_saldo(
                monto=monto_credito,
                motivo=f"Cancelacion anticipada del turno #{turno.id} - {turno.servicio.nombre}",
            )

            ultimo_movimiento = billetera.movimientos.first()
            if ultimo_movimiento:
                ultimo_movimiento.turno = turno
                ultimo_movimiento.save(update_fields=["turno"])

            credito_aplicado = True
            monto_credito_valor = monto_credito

    turno.estado = "cancelado"
    turno.motivo_cancelacion = motivo
    turno.save(update_fields=["estado", "motivo_cancelacion", "updated_at"])

    nombre_usuario = getattr(usuario, "full_name", None) or str(usuario)
    HistorialTurno.objects.create(
        turno=turno,
        usuario=usuario,
        accion="Turno cancelado",
        estado_anterior=estado_anterior,
        estado_nuevo="cancelado",
        observaciones=(
            f"Turno cancelado por {nombre_usuario}. "
            f"Motivo: {motivo}. "
            f"Credito {'aplicado' if credito_aplicado else f'no aplicado (menos de {min_horas_credito}hs)'}"
        ),
    )

    return CancelacionTurnoResult(
        credito_aplicado=credito_aplicado,
        monto_credito=float(monto_credito_valor),
        horas_antelacion_requerida=min_horas_credito,
    )
