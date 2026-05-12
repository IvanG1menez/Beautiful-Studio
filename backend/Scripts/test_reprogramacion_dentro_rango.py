"""Crea y reprograma un turno dentro del rango permitido.

Este script limpia antes los datos generados por scripts de reprogramacion para
evitar cruces con otros escenarios.
"""

from decimal import Decimal

from reprogramacion_test_utils import (
    bootstrap_django,
    cleanup_previous_reprogramming_tests,
    create_turno,
    ensure_demo_base,
    get_demo_entities,
    next_weekday_at,
)


def run():
    from apps.authentication.models import ConfiguracionGlobal
    from apps.turnos.models import HistorialTurno
    from apps.turnos.services.reprogramacion_service import reprogramar_turno

    print("\n=== Escenario: reprogramacion dentro del rango permitido ===")
    deleted = cleanup_previous_reprogramming_tests()
    print(f"- Limpieza previa: {deleted}")
    ensure_demo_base()

    config = ConfiguracionGlobal.get_config()
    brecha_horas = max(1, int(config.min_horas_cancelacion_credito or 24))
    cliente, empleado, servicio = get_demo_entities()

    fecha_original = next_weekday_at(11, 0, days_ahead=4)
    fecha_nueva = next_weekday_at(13, 30, days_ahead=7)
    monto_senia = (Decimal(str(servicio.precio)) / Decimal("2")).quantize(Decimal("0.01"))

    turno = create_turno(
        cliente=cliente,
        empleado=empleado,
        servicio=servicio,
        fecha_hora=fecha_original,
        estado="confirmado",
        tipo_pago="SENIA",
        senia_pagada=monto_senia,
        metodo_pago="mercadopago",
        precio_final=servicio.precio,
        notas_extra="DENTRO_RANGO",
    )

    print(f"- Brecha configurada: {brecha_horas} horas")
    print(f"- Turno original creado: #{turno.id} -> {turno.fecha_hora}")
    print(f"- Nueva fecha objetivo: {fecha_nueva}")

    resultado = reprogramar_turno(
        turno=turno,
        usuario=cliente.user,
        fecha_hora_nueva=fecha_nueva,
        motivo="Script prueba dentro de rango permitido",
    )

    turno.refresh_from_db()
    historial = HistorialTurno.objects.filter(turno=turno).order_by("-created_at").first()

    if resultado.penalidad_aplicada:
        raise AssertionError("No debia aplicar penalidad dentro del rango permitido")
    if turno.fecha_hora != fecha_nueva:
        raise AssertionError("La fecha nueva no quedo guardada")
    if turno.estado != "pendiente":
        raise AssertionError(f"Se esperaba estado pendiente por reprogramacion cliente y se obtuvo {turno.estado}")

    print("✅ Reprogramacion dentro de rango ejecutada correctamente.")
    print(f"- Turno reprogramado: #{turno.id} -> {turno.fecha_hora}")
    print(f"- Penalidad aplicada: {resultado.penalidad_aplicada}")
    print(f"- Estado final: {turno.estado}")
    print(f"- Pago final: tipo_pago={turno.tipo_pago}, senia_pagada={turno.senia_pagada}")
    if historial:
        print(f"- Historial: {historial.accion} | {historial.observaciones}")


if __name__ == "__main__":
    bootstrap_django()
    run()
