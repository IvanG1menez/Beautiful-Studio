from decimal import Decimal

from apps.turnos.models import MovimientoPagoTurno, Turno


def inferir_tipo_movimiento(turno: Turno, monto) -> str:
    monto_decimal = Decimal(str(monto or "0"))
    precio_total = Decimal(str(turno.precio_final or getattr(turno.servicio, "precio", 0) or 0))
    abonado_antes = Decimal(str(turno.senia_pagada or 0)) - monto_decimal

    if precio_total > 0 and monto_decimal >= precio_total and abonado_antes <= Decimal("0.00"):
        return "pago_completo"
    if abonado_antes > Decimal("0.00"):
        return "saldo"
    return "senia"


def registrar_movimiento_pago_turno(
    *,
    turno: Turno,
    monto,
    metodo: str,
    tipo: str | None = None,
    estado: str = "aprobado",
    referencia: str = "",
    descripcion: str = "",
    origen: str = "",
    registrado_por=None,
) -> MovimientoPagoTurno:
    monto_decimal = Decimal(str(monto or "0"))
    referencia = str(referencia or "").strip()
    tipo = tipo or inferir_tipo_movimiento(turno, monto_decimal)

    if referencia:
        existente = MovimientoPagoTurno.objects.filter(
            turno=turno,
            referencia=referencia,
            metodo=metodo,
            estado=estado,
        ).first()
        if existente:
            return existente

    return MovimientoPagoTurno.objects.create(
        turno=turno,
        cliente=turno.cliente,
        monto=monto_decimal,
        metodo=metodo,
        tipo=tipo,
        estado=estado,
        referencia=referencia,
        descripcion=descripcion[:255] if descripcion else "",
        origen=origen[:40] if origen else "",
        registrado_por=registrado_por,
    )
