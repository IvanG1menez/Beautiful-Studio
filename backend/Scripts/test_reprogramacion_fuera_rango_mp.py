"""Crea un turno fuera de rango y genera preferencia MP de reprogramacion.

Este script limpia antes los datos generados por scripts de reprogramacion para
evitar cruces con otros escenarios. No confirma el pago: imprime el init_point
para abrir Mercado Pago y deja al webhook/polling la confirmacion real.
"""

from datetime import timedelta
from decimal import Decimal

from reprogramacion_test_utils import (
    assert_error_contiene,
    bootstrap_django,
    cleanup_previous_reprogramming_tests,
    create_turno,
    ensure_demo_base,
    get_demo_entities,
    next_weekday_at,
)


def run(tipo_pago: str = "SENIA"):
    from django.utils import timezone
    from rest_framework.test import APIClient

    from apps.authentication.models import ConfiguracionGlobal
    from apps.turnos.services.reprogramacion_service import reprogramar_turno

    tipo_pago = (tipo_pago or "SENIA").upper()
    if tipo_pago not in {"SENIA", "PAGO_COMPLETO"}:
        raise ValueError("tipo_pago debe ser SENIA o PAGO_COMPLETO")

    print("\n=== Escenario: reprogramacion fuera de rango con Mercado Pago ===")
    deleted = cleanup_previous_reprogramming_tests()
    print(f"- Limpieza previa: {deleted}")
    ensure_demo_base()

    config = ConfiguracionGlobal.get_config()
    brecha_horas = max(1, int(config.min_horas_cancelacion_credito or 24))
    cliente, empleado, servicio = get_demo_entities()

    fecha_original = timezone.now() + timedelta(hours=max(1, min(12, brecha_horas - 1)))
    fecha_nueva = next_weekday_at(15, 0, days_ahead=5)
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
        notas_extra="FUERA_RANGO_MP",
    )

    print(f"- Brecha configurada: {brecha_horas} horas")
    print(f"- Turno original creado dentro de la ventana: #{turno.id} -> {turno.fecha_hora}")
    print(f"- Nueva fecha objetivo: {fecha_nueva}")

    try:
        reprogramar_turno(
            turno=turno,
            usuario=cliente.user,
            fecha_hora_nueva=fecha_nueva,
            motivo="Script prueba fuera de rango sin aceptar pago",
        )
        raise AssertionError("Se esperaba advertencia por reprogramacion fuera de rango")
    except ValueError as exc:
        assert_error_contiene(exc, "abonar nuevamente")
        print(f"- Advertencia esperada capturada: {exc}")

    client = APIClient()
    client.force_authenticate(user=cliente.user)
    response = client.post(
        "/api/mercadopago/preferencia-reprogramacion/",
        {
            "turno_id": turno.id,
            "nueva_fecha_hora": fecha_nueva.isoformat(),
            "motivo": "Script prueba fuera de rango con pago MP",
            "tipo_pago": tipo_pago,
        },
        format="json",
    )

    print(f"- Respuesta preferencia MP: HTTP {response.status_code}")
    if response.status_code != 201:
        print(f"- Body: {response.data}")
        raise AssertionError("No se pudo crear la preferencia MP de reprogramacion")

    data = response.data
    print("✅ Preferencia MP de reprogramacion creada correctamente.")
    print(f"- Tipo pago elegido: {data.get('tipo_pago')}")
    print(f"- Monto a abonar: {data.get('monto')}")
    print(f"- Preference ID: {data.get('preference_id')}")
    print(f"- Init point: {data.get('init_point')}")

    verify_response = client.get(
        f"/api/mercadopago/verificar-pago/{data.get('preference_id')}/"
    )
    print(f"- Verificacion polling inicial: HTTP {verify_response.status_code} {verify_response.data}")
    if verify_response.status_code != 200:
        raise AssertionError("No se pudo consultar el estado de pago de la preferencia")

    estado_pago = verify_response.data.get("status")
    if estado_pago == "approved":
        turno.refresh_from_db()
        if turno.fecha_hora != fecha_nueva:
            raise AssertionError("El pago figura aprobado pero el turno no fue reprogramado")
        print("✅ Pago aprobado y turno reprogramado correctamente por polling/fallback.")
    elif estado_pago == "pending":
        print("- Pago pendiente: abri el init_point para completar el pago. El webhook o polling aplicara la reprogramacion al aprobarse.")
    else:
        raise AssertionError(f"Estado de pago inesperado: {estado_pago}")


if __name__ == "__main__":
    bootstrap_django()
    run()
