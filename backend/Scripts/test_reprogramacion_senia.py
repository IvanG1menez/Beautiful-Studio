"""Prueba la reprogramacion de un turno con seña abonada."""

from decimal import Decimal

from reprogramacion_test_utils import (
    assert_reprogramacion_exitosa,
    bootstrap_django,
    cleanup_previous_reprogramming_tests,
    create_turno,
    ensure_demo_base,
    get_demo_entities,
    next_weekday_at,
)


def run():
    from apps.turnos.services.reprogramacion_service import reprogramar_turno

    print("\n=== Escenario Reprogramacion con Seña ===")
    cleanup_previous_reprogramming_tests()
    ensure_demo_base()

    cliente, empleado, servicio = get_demo_entities()

    fecha_original = next_weekday_at(11, 0, days_ahead=4)
    fecha_nueva = next_weekday_at(12, 30, days_ahead=7)
    monto_senia = (Decimal(str(servicio.precio)) * Decimal("0.30")).quantize(Decimal("0.01"))

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
        notas_extra="Caso seña",
    )

    print(f"- Turno original creado: #{turno.id} -> {turno.fecha_hora}")
    print(f"- Seña registrada: {monto_senia}")

    resultado = reprogramar_turno(
        turno=turno,
        usuario=cliente.user,
        fecha_hora_nueva=fecha_nueva,
        motivo="Prueba turno con seña",
    )
    assert_reprogramacion_exitosa(resultado, turno, fecha_nueva)

    print("✅ Caso seña verificado correctamente.")
    print(f"- Nuevo turno: #{turno.id} -> {turno.fecha_hora}")
    print(f"- Penalidad aplicada: {resultado.penalidad_aplicada}")
    print(f"- Seña reiniciada: {resultado.sena_reiniciada}")


if __name__ == "__main__":
    bootstrap_django()
    run()
