"""Prueba la reprogramacion de un turno ya abonado completo."""

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

    print("\n=== Escenario Reprogramacion con Pago Completo ===")
    cleanup_previous_reprogramming_tests()
    ensure_demo_base()

    cliente, empleado, servicio = get_demo_entities()

    fecha_original = next_weekday_at(11, 0, days_ahead=5)
    fecha_nueva = next_weekday_at(16, 0, days_ahead=8)
    precio_total = Decimal(str(servicio.precio))

    turno = create_turno(
        cliente=cliente,
        empleado=empleado,
        servicio=servicio,
        fecha_hora=fecha_original,
        estado="confirmado",
        tipo_pago="PAGO_COMPLETO",
        senia_pagada=precio_total,
        metodo_pago="mercadopago",
        precio_final=precio_total,
        notas_extra="Caso pago completo",
    )

    print(f"- Turno original creado: #{turno.id} -> {turno.fecha_hora}")
    print(f"- Pago completo registrado: {precio_total}")

    resultado = reprogramar_turno(
        turno=turno,
        usuario=cliente.user,
        fecha_hora_nueva=fecha_nueva,
        motivo="Prueba turno pagado completo",
    )
    assert_reprogramacion_exitosa(resultado, turno, fecha_nueva)

    print("✅ Caso pago completo verificado correctamente.")
    print(f"- Nuevo turno: #{turno.id} -> {turno.fecha_hora}")
    print(f"- Penalidad aplicada: {resultado.penalidad_aplicada}")
    print(f"- Seña reiniciada: {resultado.sena_reiniciada}")


if __name__ == "__main__":
    bootstrap_django()
    run()
