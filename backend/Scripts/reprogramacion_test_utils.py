"""Utilidades compartidas para scripts de prueba de reprogramacion."""

from __future__ import annotations

import os
import sys
from datetime import datetime, time, timedelta
from decimal import Decimal


SCENARIO_PREFIX = "[TEST_REPROGRAMACION]"
DEMO_CLIENT_EMAIL = "cliente1@beautifulstudio.com"
DEMO_PRO_EMAIL = "profesional@beautifulstudio.com"
DEMO_SERVICE_NAME = "Color completo + Brushing"


def bootstrap_django() -> None:
    """Inicializa Django para ejecucion directa de scripts."""

    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    if os.environ.get("DJANGO_SETTINGS_MODULE"):
        return

    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

    import django

    django.setup()


def ensure_demo_base() -> None:
    """Asegura que existan los usuarios, empleados y servicio demo."""

    from Scripts.reset_datos_demo import crear_usuarios_base

    crear_usuarios_base()


def cleanup_previous_reprogramming_tests(reset_monthly_limit: bool = True) -> dict[str, int]:
    """Elimina turnos y relaciones generadas por los scripts de reprogramacion."""

    from django.db.models import Q
    from django.utils import timezone

    from apps.mercadopago.models import PagoMercadoPago
    from apps.turnos.models import (
        HistorialTurno,
        LogReasignacion,
        Turno,
    )

    turnos_qs = Turno.objects.filter(notas_cliente__startswith=SCENARIO_PREFIX)
    turno_ids = list(turnos_qs.values_list("id", flat=True))

    deleted = {
        "turnos": 0,
        "historial": 0,
        "historial_reprogramacion": 0,
        "logs_reasignacion": 0,
        "pagos_mercadopago": 0,
    }

    if turno_ids:
        historial_qs = HistorialTurno.objects.filter(turno_id__in=turno_ids)
        deleted["historial"] = historial_qs.count()
        historial_qs.delete()

        logs_qs = LogReasignacion.objects.filter(
            Q(turno_cancelado_id__in=turno_ids) | Q(turno_ofrecido_id__in=turno_ids)
        )
        deleted["logs_reasignacion"] = logs_qs.count()
        logs_qs.delete()

        pagos_qs = PagoMercadoPago.objects.filter(turno_id__in=turno_ids)
        deleted["pagos_mercadopago"] = pagos_qs.count()
        pagos_qs.delete()

        deleted["turnos"], _ = turnos_qs.delete()

    if reset_monthly_limit:
        inicio_mes = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        historial_reprogramacion_qs = HistorialTurno.objects.filter(
            turno__cliente__user__email=DEMO_CLIENT_EMAIL,
            turno__servicio__nombre=DEMO_SERVICE_NAME,
            accion="Reprogramacion de turno",
            created_at__gte=inicio_mes,
        )
        deleted["historial_reprogramacion"] = historial_reprogramacion_qs.count()
        historial_reprogramacion_qs.delete()

    return deleted


def get_demo_entities():
    """Retorna el cliente, profesional y servicio demo principales."""

    from django.contrib.auth import get_user_model

    from apps.clientes.models import Cliente
    from apps.empleados.models import Empleado
    from apps.servicios.models import Servicio

    User = get_user_model()

    cliente_user = User.objects.filter(email=DEMO_CLIENT_EMAIL).first()
    if not cliente_user:
        raise RuntimeError(
            f"No se encontro el usuario demo {DEMO_CLIENT_EMAIL}. Ejecuta primero reset_datos_demo.py"
        )

    cliente = Cliente.objects.select_related("user").get(user=cliente_user)

    empleado = Empleado.objects.select_related("user").filter(
        user__email=DEMO_PRO_EMAIL
    ).first()
    if not empleado:
        empleado = Empleado.objects.select_related("user").filter(is_active=True).first()
    if not empleado:
        raise RuntimeError(
            "No se encontro un empleado activo. Ejecuta primero reset_datos_demo.py"
        )

    servicio = Servicio.objects.filter(nombre=DEMO_SERVICE_NAME).first()
    if not servicio:
        servicio = Servicio.objects.filter(is_active=True).first()
    if not servicio:
        raise RuntimeError(
            "No se encontro un servicio activo. Ejecuta primero reset_datos_demo.py"
        )

    return cliente, empleado, servicio


def create_turno(
    *,
    cliente,
    empleado,
    servicio,
    fecha_hora,
    estado: str = "confirmado",
    tipo_pago: str = "SIN_PAGO",
    senia_pagada: Decimal | str | int = Decimal("0.00"),
    metodo_pago: str | None = None,
    precio_final: Decimal | str | int | None = None,
    notas_extra: str = "",
):
    """Crea un turno de prueba de reprogramacion con nota rastreable."""

    from apps.turnos.models import Turno

    precio_final_decimal = Decimal(str(precio_final if precio_final is not None else servicio.precio))
    senia_decimal = Decimal(str(senia_pagada))

    turno = Turno.objects.create(
        cliente=cliente,
        empleado=empleado,
        servicio=servicio,
        fecha_hora=fecha_hora,
        estado=estado,
        tipo_pago=tipo_pago,
        senia_pagada=senia_decimal,
        metodo_pago=metodo_pago,
        fecha_pago_registrado=None,
        precio_final=precio_final_decimal,
        canal_reserva="web_cliente",
        notas_cliente=f"{SCENARIO_PREFIX} {notas_extra}".strip(),
    )

    return turno


def next_weekday_at(hour: int, minute: int, days_ahead: int = 0):
    """Construye un datetime aware en el siguiente dia habil a la hora indicada."""

    from django.utils import timezone

    target_date = timezone.localdate() + timedelta(days=days_ahead)
    while target_date.weekday() == 6:
        target_date += timedelta(days=1)

    candidate = datetime.combine(target_date, time(hour, minute))
    if timezone.is_naive(candidate):
        candidate = timezone.make_aware(candidate, timezone.get_current_timezone())

    while candidate <= timezone.now():
        candidate += timedelta(days=1)
        if candidate.weekday() == 6:
            candidate += timedelta(days=1)

    return candidate


def assert_reprogramacion_exitosa(resultado, turno, nueva_fecha_hora):
    """Verifica que el turno haya quedado reseteado al reprogramar como cliente."""

    turno.refresh_from_db()
    if turno.estado != "pendiente":
        raise AssertionError(f"Se esperaba estado pendiente y se obtuvo {turno.estado}")
    if turno.tipo_pago != "SIN_PAGO":
        raise AssertionError(f"Se esperaba tipo_pago SIN_PAGO y se obtuvo {turno.tipo_pago}")
    if Decimal(str(turno.senia_pagada or 0)) != Decimal("0.00"):
        raise AssertionError(
            f"Se esperaba senia_pagada = 0 y se obtuvo {turno.senia_pagada}"
        )
    if turno.fecha_hora != nueva_fecha_hora:
        raise AssertionError("La nueva fecha y hora no se guardo correctamente")
    if not resultado.sena_reiniciada:
        raise AssertionError("Se esperaba que la seña se reiniciara para el cliente")


def assert_error_contiene(error: Exception, texto: str) -> None:
    mensaje = str(error).lower()
    if texto.lower() not in mensaje:
        raise AssertionError(f"El error no contiene '{texto}': {error}")
