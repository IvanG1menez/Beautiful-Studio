"""Prueba la validacion de reprogramacion dentro de la ventana de 24 horas."""

from datetime import timedelta
from decimal import Decimal

from reprogramacion_test_utils import (
    assert_error_contiene,
    assert_reprogramacion_exitosa,
    bootstrap_django,
    cleanup_previous_reprogramming_tests,
    create_turno,
    ensure_demo_base,
    get_demo_entities,
    next_weekday_at,
)


def run():
    from django.utils import timezone

    from apps.turnos.services.reprogramacion_service import reprogramar_turno

    print("\n=== Escenario Reprogramacion 24h ===")
    cleanup_previous_reprogramming_tests()
    ensure_demo_base()

    cliente, empleado, servicio = get_demo_entities()

    fecha_original = timezone.now() + timedelta(hours=12)
    fecha_nueva = next_weekday_at(12, 30, days_ahead=3)

    turno = create_turno(
        cliente=cliente,
        empleado=empleado,
        servicio=servicio,
        fecha_hora=fecha_original,
        estado="confirmado",
        tipo_pago="SIN_PAGO",
        senia_pagada=Decimal("0.00"),
        metodo_pago=None,
        precio_final=servicio.precio,
        notas_extra="Caso 24h",
    )

    print(f"- Turno original creado: #{turno.id} -> {turno.fecha_hora}")

    try:
        reprogramar_turno(
            turno=turno,
            usuario=cliente.user,
            fecha_hora_nueva=fecha_nueva,
            motivo="Prueba ventana 24h",
        )
        raise AssertionError("Se esperaba que falle por ventana de 24h y no fallo")
    except ValueError as exc:
        assert_error_contiene(exc, "24 horas")
        print(f"- Validacion esperada capturada: {exc}")

    resultado = reprogramar_turno(
        turno=turno,
        usuario=cliente.user,
        fecha_hora_nueva=fecha_nueva,
        aceptar_penalidad_fuera_rango=True,
        motivo="Prueba ventana 24h con aceptacion",
    )
    assert_reprogramacion_exitosa(resultado, turno, fecha_nueva)

    print("✅ Caso 24h verificado correctamente.")
    print(f"- Nuevo turno: #{turno.id} -> {turno.fecha_hora}")
    print(f"- Penalidad aplicada: {resultado.penalidad_aplicada}")
    print(f"- Seña reiniciada: {resultado.sena_reiniciada}")


if __name__ == "__main__":
    bootstrap_django()
    run()
