"""Rellena turnos de prueba para la seccion "completar turnos".

Uso recomendado (desde backend):
- python Scripts/completar_turnos.py
- python Scripts/completar_turnos.py --cantidad 20 --dias 7
- python Scripts/completar_turnos.py --desactivar

Tambien puede usarse desde shell de Django:
- from Scripts.completar_turnos import run; run()
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta

SEED_NOTE_PREFIX = "[SEED_COMPLETAR_TURNOS]"


def _bootstrap_django() -> None:
    """Inicializa Django cuando se ejecuta este archivo directamente."""
    if os.environ.get("DJANGO_SETTINGS_MODULE"):
        return

    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

    import django

    django.setup()


def _asegurar_clientes_minimos(cantidad_minima: int = 6):
    """Garantiza que existan clientes suficientes para distribuir turnos."""
    from django.contrib.auth import get_user_model
    from apps.clientes.models import Cliente

    User = get_user_model()

    clientes = list(Cliente.objects.select_related("user").order_by("id"))
    faltan = max(0, cantidad_minima - len(clientes))

    for i in range(1, faltan + 1):
        idx = len(clientes) + 1
        email = f"cliente.test.{idx}@beautifulstudio.local"

        user, _ = User.objects.get_or_create(
            email=email,
            defaults={
                "username": f"cliente_test_{idx}",
                "first_name": "Cliente",
                "last_name": f"Test {idx}",
                "role": "cliente",
                "is_staff": False,
                "is_superuser": False,
            },
        )
        if user.role != "cliente":
            user.role = "cliente"
            user.save(update_fields=["role"])

        cliente, _ = Cliente.objects.get_or_create(user=user)
        clientes.append(cliente)

    return clientes


def _resolver_servicio_para_profesional(empleado):
    """Obtiene un servicio del profesional o le asigna uno activo existente."""
    from apps.empleados.models import EmpleadoServicio
    from apps.servicios.models import Servicio

    relacion = (
        empleado.servicios_disponibles.select_related("servicio")
        .filter(servicio__is_active=True)
        .order_by("id")
        .first()
    )
    if relacion:
        return relacion.servicio

    servicio = Servicio.objects.filter(is_active=True).order_by("id").first()
    if not servicio:
        raise RuntimeError(
            "No hay servicios activos. Crea al menos un Servicio antes de ejecutar este script."
        )

    EmpleadoServicio.objects.get_or_create(
        empleado=empleado,
        servicio=servicio,
        defaults={"nivel_experiencia": 2},
    )
    return servicio


def _rangos_laborales_por_dia(empleado):
    """Devuelve un mapa {dia_semana: [(hora_inicio, hora_fin), ...]} para generar slots."""
    horarios = list(
        empleado.horarios_detallados.filter(is_active=True)
        .order_by("dia_semana", "hora_inicio")
        .all()
    )

    if horarios:
        mapa = {}
        for horario in horarios:
            mapa.setdefault(horario.dia_semana, []).append(
                (horario.hora_inicio, horario.hora_fin)
            )
        return mapa

    return {
        0: [(empleado.horario_entrada, empleado.horario_salida)],
        1: [(empleado.horario_entrada, empleado.horario_salida)],
        2: [(empleado.horario_entrada, empleado.horario_salida)],
        3: [(empleado.horario_entrada, empleado.horario_salida)],
        4: [(empleado.horario_entrada, empleado.horario_salida)],
    }


def _generar_slots_pasados(rangos_por_dia, dias: int, paso_minutos: int):
    """Genera datetimes candidatos en el pasado para los ultimos dias."""
    from django.utils import timezone

    ahora = timezone.localtime()
    slots = []

    for delta in range(dias, -1, -1):
        fecha_obj = (ahora - timedelta(days=delta)).date()
        weekday = fecha_obj.weekday()

        for hora_inicio, hora_fin in rangos_por_dia.get(weekday, []):
            inicio_dt = datetime.combine(fecha_obj, hora_inicio)
            fin_dt = datetime.combine(fecha_obj, hora_fin)

            cursor = inicio_dt
            while cursor < fin_dt:
                aware_cursor = timezone.make_aware(
                    cursor, timezone.get_current_timezone()
                )
                if aware_cursor < ahora - timedelta(minutes=30):
                    slots.append(aware_cursor)
                cursor += timedelta(minutes=paso_minutos)

    return sorted(slots)


def es_turno_prueba_completar(turno) -> bool:
    """Retorna True si el turno fue generado por este script."""
    nota = (turno.notas_cliente or "").strip()
    return nota.startswith(SEED_NOTE_PREFIX)


def contar_turnos_prueba_para_empleado(empleado) -> int:
    from apps.turnos.models import Turno

    return Turno.objects.filter(
        empleado=empleado,
        notas_cliente__startswith=SEED_NOTE_PREFIX,
    ).count()


def eliminar_turnos_prueba_para_empleado(empleado) -> int:
    """Elimina unicamente los turnos de prueba generados por este script."""
    from apps.turnos.models import Turno

    eliminados, _ = Turno.objects.filter(
        empleado=empleado,
        notas_cliente__startswith=SEED_NOTE_PREFIX,
    ).delete()
    return int(eliminados)


def seed_turnos_prueba_para_empleado(
    empleado,
    cantidad: int = 15,
    dias: int = 30,
    limpiar_previos: bool = True,
):
    """Genera turnos viejos de prueba para completar turnos del profesional."""
    from django.utils import timezone
    from apps.clientes.models import Cliente
    from apps.turnos.models import Turno

    if not empleado.is_disponible:
        empleado.is_disponible = True
        empleado.save(update_fields=["is_disponible"])

    servicio = _resolver_servicio_para_profesional(empleado)

    clientes = list(Cliente.objects.select_related("user").order_by("id"))
    if len(clientes) < 3:
        clientes = _asegurar_clientes_minimos(cantidad_minima=6)

    if limpiar_previos:
        eliminar_turnos_prueba_para_empleado(empleado)

    rangos_por_dia = _rangos_laborales_por_dia(empleado)
    paso_minutos = max(
        30, min(90, int(getattr(servicio, "duracion_minutos", 60) or 60))
    )
    slots = _generar_slots_pasados(rangos_por_dia, dias=dias, paso_minutos=paso_minutos)

    estado_cycle = ["pendiente", "confirmado", "en_proceso"]
    creados = 0
    existentes = 0

    if not slots:
        return {
            "creados": 0,
            "existentes": 0,
            "total_completables_en_ventana": 0,
            "total_prueba_activos": contar_turnos_prueba_para_empleado(empleado),
            "servicio_id": servicio.id,
            "servicio_nombre": servicio.nombre,
        }

    # Tomar slots recientes primero y forzar creacion con pequenos offsets si hay colision.
    slots_objetivo = list(reversed(slots))
    indice = 0

    for base_fecha_hora in slots_objetivo:
        if creados >= cantidad:
            break

        cliente = clientes[indice % len(clientes)]
        estado = estado_cycle[indice % len(estado_cycle)]
        indice += 1

        candidato = None
        for offset_min in [0, 5, 10, 15, 20, 25]:
            posible = base_fecha_hora + timedelta(minutes=offset_min)
            if not Turno.objects.filter(empleado=empleado, fecha_hora=posible).exists():
                candidato = posible
                break

        if candidato is None:
            existentes += 1
            continue

        Turno.objects.create(
            empleado=empleado,
            fecha_hora=candidato,
            cliente=cliente,
            servicio=servicio,
            estado=estado,
            precio_final=servicio.precio,
            notas_cliente=f"{SEED_NOTE_PREFIX} Turno de prueba para completar masivo.",
        )
        creados += 1

    ahora = timezone.now()
    fecha_desde = ahora - timedelta(days=max(1, dias))
    pendientes = Turno.objects.filter(
        empleado=empleado,
        fecha_hora__gte=fecha_desde,
        fecha_hora__lte=ahora,
        estado__in=["pendiente", "confirmado", "en_proceso"],
    ).count()

    return {
        "creados": creados,
        "existentes": existentes,
        "total_completables_en_ventana": int(pendientes),
        "total_prueba_activos": contar_turnos_prueba_para_empleado(empleado),
        "servicio_id": servicio.id,
        "servicio_nombre": servicio.nombre,
    }


def run(cantidad: int = 15, dias: int = 30, reemplazar: bool = False, empleado_id=None):
    """CLI principal para generar datos de prueba."""
    from apps.empleados.models import Empleado

    if empleado_id is not None:
        empleado = (
            Empleado.objects.select_related("user").filter(id=empleado_id).first()
        )
        if not empleado:
            print(f"No existe profesional con id={empleado_id}.")
            return
    else:
        profesionales = list(Empleado.objects.select_related("user").order_by("id"))
        if not profesionales:
            print("No hay profesionales cargados en la base de datos.")
            return
        empleado = profesionales[0]
        if len(profesionales) > 1:
            print(
                f"Hay {len(profesionales)} profesionales. Se usara el primero: "
                f"{empleado.nombre_completo} (id={empleado.id})."
            )

    if reemplazar:
        eliminados = eliminar_turnos_prueba_para_empleado(empleado)
        print(f"Turnos de prueba eliminados previamente: {eliminados}")

    resultado = seed_turnos_prueba_para_empleado(
        empleado=empleado,
        cantidad=max(1, int(cantidad)),
        dias=max(1, int(dias)),
        limpiar_previos=False,
    )

    print("\nResumen de completar_turnos")
    print(f"- Profesional: {empleado.nombre_completo} (id={empleado.id})")
    print(
        f"- Servicio usado: {resultado['servicio_nombre']} "
        f"(id={resultado['servicio_id']})"
    )
    print(f"- Turnos creados: {resultado['creados']}")
    print(f"- Turnos ya existentes (mismo horario): {resultado['existentes']}")
    print(
        f"- Total completables en ventana: {resultado['total_completables_en_ventana']}"
    )
    print(f"- Total turnos de prueba activos: {resultado['total_prueba_activos']}")


def _parse_args():
    parser = argparse.ArgumentParser(
        description="Genera o borra turnos de prueba para completar turnos."
    )
    parser.add_argument(
        "--cantidad",
        type=int,
        default=15,
        help="Cantidad objetivo de turnos a generar (default: 15).",
    )
    parser.add_argument(
        "--dias",
        type=int,
        default=30,
        help="Dias hacia atras para buscar horarios (default: 30).",
    )
    parser.add_argument(
        "--reemplazar",
        action="store_true",
        help="Limpia primero los turnos de prueba existentes y luego regenera.",
    )
    parser.add_argument(
        "--desactivar",
        action="store_true",
        help="Elimina turnos de prueba del profesional objetivo.",
    )
    parser.add_argument(
        "--empleado-id",
        type=int,
        default=None,
        help="ID del profesional a usar. Si no se envia, usa el primero.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    _bootstrap_django()
    args = _parse_args()

    from apps.empleados.models import Empleado

    if args.empleado_id is not None:
        empleado = Empleado.objects.filter(id=args.empleado_id).first()
    else:
        empleado = Empleado.objects.order_by("id").first()

    if not empleado:
        print("No hay profesionales disponibles.")
        raise SystemExit(1)

    if args.desactivar:
        eliminados = eliminar_turnos_prueba_para_empleado(empleado)
        print(f"Turnos de prueba eliminados: {eliminados}")
    else:
        run(
            cantidad=max(1, args.cantidad),
            dias=max(1, args.dias),
            reemplazar=args.reemplazar,
            empleado_id=args.empleado_id,
        )
