"""Genera turnos de prueba para validar la UI de cliente.

Crea exactamente 3 turnos futuros para un cliente:
- 1 turno para manana
- 2 turnos para dias posteriores

Uso (desde backend):
- python Scripts/generar_turnos_ui.py
- python Scripts/generar_turnos_ui.py --cliente-email cliente1@beautifulstudio.com
- python Scripts/generar_turnos_ui.py --dias 1,4,9
- python Scripts/generar_turnos_ui.py --limpiar-previos
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, time, timedelta
from decimal import Decimal

SEED_NOTE_PREFIX = "[SEED_UI_PROXIMOS]"


def _bootstrap_django() -> None:
    """Inicializa Django cuando se ejecuta el script directamente."""
    if os.environ.get("DJANGO_SETTINGS_MODULE"):
        return

    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

    import django

    django.setup()


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generar 3 turnos futuros para UI.")
    parser.add_argument(
        "--cliente-email",
        type=str,
        default="",
        help="Email del cliente para asignar los turnos.",
    )
    parser.add_argument(
        "--dias",
        type=str,
        default="1,3,7",
        help="Offsets de dias para los 3 turnos (ej: 1,4,9).",
    )
    parser.add_argument(
        "--limpiar-previos",
        action="store_true",
        help="Elimina turnos previos creados por este script para ese cliente.",
    )
    return parser.parse_args()


def _resolver_offsets(dias_raw: str) -> list[int]:
    partes = [p.strip() for p in dias_raw.split(",") if p.strip()]
    if len(partes) != 3:
        raise ValueError("Debes pasar exactamente 3 offsets de dias en --dias")

    offsets = [int(p) for p in partes]
    if any(d <= 0 for d in offsets):
        raise ValueError("Todos los offsets deben ser mayores a 0")

    offsets.sort()
    return offsets


def _obtener_cliente(cliente_email: str):
    from apps.clientes.models import Cliente

    qs = Cliente.objects.select_related("user").filter(is_active=True)

    if cliente_email:
        cliente = qs.filter(user__email__iexact=cliente_email).first()
        if not cliente:
            raise RuntimeError(
                f"No se encontro cliente activo con email: {cliente_email}"
            )
        return cliente

    cliente = qs.order_by("id").first()
    if not cliente:
        raise RuntimeError("No hay clientes activos en la base de datos.")
    return cliente


def _obtener_empleado_y_servicio():
    from apps.empleados.models import Empleado, EmpleadoServicio
    from apps.servicios.models import Servicio

    relacion = (
        EmpleadoServicio.objects.select_related("empleado", "servicio")
        .filter(empleado__is_active=True, empleado__is_disponible=True, servicio__is_active=True)
        .order_by("id")
        .first()
    )

    if relacion:
        return relacion.empleado, relacion.servicio

    empleado = Empleado.objects.filter(is_active=True, is_disponible=True).order_by("id").first()
    if not empleado:
        raise RuntimeError("No hay profesionales activos/disponibles.")

    servicio = Servicio.objects.filter(is_active=True).order_by("id").first()
    if not servicio:
        raise RuntimeError("No hay servicios activos.")

    EmpleadoServicio.objects.get_or_create(
        empleado=empleado,
        servicio=servicio,
        defaults={"nivel_experiencia": 2},
    )

    return empleado, servicio


def _aware_local_datetime(fecha_obj, hora_obj):
    from django.utils import timezone

    dt = datetime.combine(fecha_obj, hora_obj)
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def _buscar_horario_libre(empleado, fecha_obj, horas_candidatas: list[time]):
    from django.utils import timezone
    from apps.turnos.models import Turno

    # Primero intenta horas concretas para que la UI se vea ordenada.
    for hora in horas_candidatas:
        candidato = _aware_local_datetime(fecha_obj, hora)
        if candidato <= timezone.now():
            continue
        if not Turno.objects.filter(empleado=empleado, fecha_hora=candidato).exists():
            return candidato

    # Si colisiona todo, prueba cada 15 minutos desde la primera hora candidata.
    base = _aware_local_datetime(fecha_obj, horas_candidatas[0])
    for i in range(1, 41):
        candidato = base + timedelta(minutes=15 * i)
        if candidato <= timezone.now():
            continue
        if not Turno.objects.filter(empleado=empleado, fecha_hora=candidato).exists():
            return candidato

    raise RuntimeError(
        f"No se encontro horario libre para {fecha_obj.isoformat()} con empleado {empleado.id}."
    )


def _limpiar_previos(cliente) -> int:
    from apps.turnos.models import Turno

    eliminados, _ = Turno.objects.filter(
        cliente=cliente,
        notas_cliente__startswith=SEED_NOTE_PREFIX,
    ).delete()
    return int(eliminados)


def run(
    cliente_email: str = "",
    dias: str = "1,3,7",
    limpiar_previos: bool = False,
) -> dict:
    from django.utils import timezone
    from apps.turnos.models import Turno

    offsets = _resolver_offsets(dias)
    cliente = _obtener_cliente(cliente_email)
    empleado, servicio = _obtener_empleado_y_servicio()

    if limpiar_previos:
        eliminados = _limpiar_previos(cliente)
        print(f"- Turnos previos eliminados para cliente #{cliente.id}: {eliminados}")

    hoy_local = timezone.localtime().date()

    estados = ["confirmado", "pendiente", "confirmado"]
    horas_candidatas = [time(10, 0), time(12, 30), time(16, 0)]

    creados = []
    for idx, offset in enumerate(offsets):
        fecha_obj = hoy_local + timedelta(days=offset)
        fecha_hora = _buscar_horario_libre(empleado, fecha_obj, horas_candidatas)

        turno = Turno.objects.create(
            cliente=cliente,
            empleado=empleado,
            servicio=servicio,
            fecha_hora=fecha_hora,
            estado=estados[idx],
            precio_final=Decimal(servicio.precio or 0),
            senia_pagada=Decimal("0.00"),
            canal_reserva="web_cliente",
            tipo_pago="SIN_PAGO",
            metodo_pago=None,
            notas_cliente=(
                f"{SEED_NOTE_PREFIX} Turno de prueba UI #{idx + 1} "
                f"(offset_dias={offset})."
            ),
        )
        creados.append(turno)

    print("\nTurnos de prueba creados correctamente:\n")
    for turno in creados:
        fecha_str = timezone.localtime(turno.fecha_hora).strftime("%d/%m/%Y %H:%M")
        print(
            f"- Turno #{turno.id} | Cliente: {cliente.nombre_completo} | "
            f"Servicio: {turno.servicio.nombre} | Fecha: {fecha_str} | "
            f"Estado: {turno.estado}"
        )

    return {
        "cliente_id": cliente.id,
        "cliente_email": getattr(cliente.user, "email", ""),
        "empleado_id": empleado.id,
        "servicio_id": servicio.id,
        "turnos_ids": [t.id for t in creados],
    }


def main() -> None:
    _bootstrap_django()
    args = _parse_args()
    run(
        cliente_email=args.cliente_email,
        dias=args.dias,
        limpiar_previos=args.limpiar_previos,
    )


if __name__ == "__main__":
    main()
