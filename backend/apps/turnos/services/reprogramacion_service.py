"""Servicios de reprogramacion de turnos reutilizables."""

from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.authentication.models import ConfiguracionGlobal
from apps.empleados.models import Empleado, EmpleadoServicio, HorarioEmpleado
from apps.turnos.models import HistorialTurno, LogReasignacion, Turno

ESTADOS_SOLAPAMIENTO = ["pendiente", "confirmado", "en_proceso", "oferta_enviada"]


@dataclass
class ReprogramacionTurnoResult:
    turno: Turno
    fecha_hora_anterior: timezone.datetime
    fecha_hora_nueva: timezone.datetime
    sena_reiniciada: bool
    penalidad_aplicada: bool
    brecha_horas: int
    mensaje_penalidad: str


def _validar_turno_reprogramable(turno: Turno) -> None:
    if turno.estado != "confirmado":
        raise ValueError(
            "Solo se pueden reprogramar turnos en estado confirmado."
        )


def _obtener_brecha_horas() -> int:
    config_global = ConfiguracionGlobal.get_config()
    return max(1, int(config_global.min_horas_cancelacion_credito or 24))


def _esta_en_ventana_sin_penalidad(turno: Turno, ahora) -> bool:
    brecha_horas = _obtener_brecha_horas()
    limite = turno.fecha_hora - timedelta(hours=brecha_horas)
    return ahora <= limite


def validar_rango_reprogramacion(turno: Turno, fecha_hora_nueva, ahora=None) -> None:
    """Valida que la nueva fecha este dentro del rango configurado."""
    estado = obtener_estado_rango_reprogramacion(turno, fecha_hora_nueva, ahora)
    if not estado["puede_reprogramar"]:
        raise ValueError(estado["motivo"])


def obtener_estado_rango_reprogramacion(turno: Turno, fecha_hora_nueva=None, ahora=None) -> dict:
    """Devuelve el estado del rango permitido sin lanzar excepciones."""
    ahora = ahora or timezone.now()
    config = ConfiguracionGlobal.get_config()
    dias_rango = int(getattr(config, "dias_rango_reprogramacion", 14) or 14)
    if dias_rango not in (7, 14):
        dias_rango = 14

    fecha_maxima = ahora + timedelta(days=dias_rango)

    if fecha_hora_nueva and fecha_hora_nueva > fecha_maxima:
        return {
            "puede_reprogramar": False,
            "codigo": "fuera_rango_reprogramacion",
            "dias_rango": dias_rango,
            "fecha_maxima": fecha_maxima,
            "motivo": (
                f"Solo podés reprogramar dentro de los próximos {dias_rango} días. "
                "Elegí una fecha dentro del rango permitido."
            ),
        }

    return {
        "puede_reprogramar": True,
        "codigo": "disponible",
        "dias_rango": dias_rango,
        "fecha_maxima": fecha_maxima,
        "motivo": "",
    }


def _validar_sin_oferta_reasignacion_activa(turno: Turno, ahora) -> None:
    hay_oferta_activa = LogReasignacion.objects.filter(
        Q(turno_cancelado=turno) | Q(turno_ofrecido=turno),
        estado_final__isnull=True,
        expires_at__gt=ahora,
    ).exists()

    if hay_oferta_activa:
        raise ValueError(
            "No se puede reprogramar este turno mientras exista una oferta de reasignacion activa."
        )


def _validar_profesional_habilitado(
    empleado: Empleado,
    servicio,
    requerir_relacion_servicio: bool,
) -> None:
    if not empleado.is_disponible:
        raise ValueError("El profesional seleccionado no se encuentra disponible.")

    if not requerir_relacion_servicio:
        return

    puede_realizar_servicio = EmpleadoServicio.objects.filter(
        empleado=empleado,
        servicio=servicio,
    ).exists()
    if not puede_realizar_servicio:
        raise ValueError(
            "El profesional seleccionado no puede realizar este servicio."
        )


def _validar_disponibilidad_empleado(turno: Turno, empleado: Empleado, fecha_hora_nueva) -> None:
    servicio = turno.servicio

    if Turno.objects.filter(empleado=empleado, fecha_hora=fecha_hora_nueva).exclude(
        pk=turno.pk
    ).exists():
        raise ValueError(
            "Este horario ya esta ocupado. Por favor selecciona otro horario."
        )

    hora_fin_nueva = fecha_hora_nueva + timedelta(minutes=servicio.duracion_minutos)

    turnos_existentes = Turno.objects.filter(
        empleado=empleado,
        estado__in=ESTADOS_SOLAPAMIENTO,
    ).exclude(pk=turno.pk)

    for turno_existente in turnos_existentes:
        turno_fin = turno_existente.fecha_hora + timedelta(
            minutes=turno_existente.servicio.duracion_minutos
        )
        if fecha_hora_nueva < turno_fin and hora_fin_nueva > turno_existente.fecha_hora:
            raise ValueError("El profesional ya tiene un turno agendado en ese horario.")

    dia_semana = fecha_hora_nueva.weekday()
    horarios_dia = HorarioEmpleado.objects.filter(
        empleado=empleado,
        dia_semana=dia_semana,
        is_active=True,
    ).order_by("hora_inicio")

    if horarios_dia.exists():
        hora_inicio_turno = fecha_hora_nueva.time()
        if hora_fin_nueva.date() != fecha_hora_nueva.date():
            raise ValueError("El turno no puede finalizar en un dia distinto al de inicio.")

        hora_fin_turno = hora_fin_nueva.time()
        encaja_en_rango = any(
            horario.hora_inicio <= hora_inicio_turno
            and hora_fin_turno <= horario.hora_fin
            for horario in horarios_dia
        )
        if not encaja_en_rango:
            raise ValueError("El profesional no trabaja en ese horario.")
        return

    dias_trabajo = empleado.dias_trabajo.split(",")
    dias_map = {"L": 0, "M": 1, "Mi": 2, "J": 3, "V": 4, "S": 5, "D": 6}
    dias_numericos = []
    for dia in dias_trabajo:
        dia = dia.strip()
        if dia in dias_map:
            dias_numericos.append(dias_map[dia])

    if dia_semana not in dias_numericos:
        raise ValueError("El profesional no trabaja ese dia.")

    hora_turno = fecha_hora_nueva.time()
    if hora_fin_nueva.date() != fecha_hora_nueva.date():
        raise ValueError("El turno no puede finalizar en un dia distinto al de inicio.")

    hora_fin_turno = hora_fin_nueva.time()
    if (
        hora_turno < empleado.horario_entrada
        or hora_fin_turno > empleado.horario_salida
    ):
        raise ValueError(
            f"El horario debe estar entre {empleado.horario_entrada} y {empleado.horario_salida}."
        )


def reprogramar_turno(
    turno: Turno,
    usuario,
    fecha_hora_nueva,
    nuevo_empleado_id=None,
    aceptar_penalidad_fuera_rango: bool = False,
    motivo: str = "",
    origen: str = "panel",
    reiniciar_pago_cliente: bool | None = None,
    permitir_sobreturno: bool = False,
) -> ReprogramacionTurnoResult:
    ahora = timezone.now()
    brecha_horas = _obtener_brecha_horas()

    _validar_turno_reprogramable(turno)
    _validar_sin_oferta_reasignacion_activa(turno, ahora)
    en_ventana = _esta_en_ventana_sin_penalidad(turno, ahora)
    servicio_nombre = getattr(turno.servicio, "nombre", "servicio")
    monto_servicio = Decimal(str(getattr(turno.servicio, "precio", 0) or 0))
    mensaje_penalidad = (
        f"Estas fuera del rango de {brecha_horas} horas. "
        "Por politicas de la empresa deberas abonar nuevamente el dia del turno que elijas. "
        f"El monto del {servicio_nombre} es de {monto_servicio:.2f}. "
        "Confirma para continuar."
    )
    if not en_ventana and not aceptar_penalidad_fuera_rango:
        raise ValueError(mensaje_penalidad)

    if fecha_hora_nueva <= ahora:
        raise ValueError("No se puede reprogramar un turno en el pasado.")

    if hasattr(usuario, "cliente_profile"):
        validar_rango_reprogramacion(turno, fecha_hora_nueva, ahora)

    if fecha_hora_nueva == turno.fecha_hora:
        raise ValueError("La nueva fecha y hora debe ser distinta de la actual.")

    empleado_destino = turno.empleado
    cambio_profesional = False
    if nuevo_empleado_id and int(nuevo_empleado_id) != turno.empleado_id:
        try:
            empleado_destino = Empleado.objects.get(pk=nuevo_empleado_id)
        except Empleado.DoesNotExist:
            raise ValueError("El profesional seleccionado no existe.")
        cambio_profesional = True

    _validar_profesional_habilitado(
        empleado_destino,
        turno.servicio,
        requerir_relacion_servicio=cambio_profesional,
    )
    if not permitir_sobreturno:
        _validar_disponibilidad_empleado(turno, empleado_destino, fecha_hora_nueva)

        try:
            turno.validar_capacidad_salas(
                fecha_hora=fecha_hora_nueva,
                servicio=turno.servicio,
            )
        except Exception as exc:
            mensaje = getattr(exc, "messages", None)
            detalle = mensaje[0] if mensaje else str(exc)
            raise ValueError(detalle)

    fecha_hora_anterior = turno.fecha_hora
    empleado_anterior = turno.empleado
    motivo_normalizado = (motivo or "").strip()
    es_cliente = hasattr(usuario, "cliente_profile")
    if reiniciar_pago_cliente is None:
        reiniciar_pago_cliente = es_cliente
    sena_reiniciada = False
    penalidad_aplicada = False

    with transaction.atomic():
        turno.empleado = empleado_destino
        turno.fecha_hora = fecha_hora_nueva

        update_fields = ["empleado", "fecha_hora", "updated_at"]

        if reiniciar_pago_cliente:
            # Toda reprogramacion originada por el cliente vuelve a pendiente y sin pago previo.
            turno.senia_pagada = Decimal("0.00")
            turno.tipo_pago = "SIN_PAGO"
            turno.metodo_pago = None
            turno.fecha_pago_registrado = None
            turno.estado = "pendiente"
            update_fields.extend(
                [
                    "senia_pagada",
                    "tipo_pago",
                    "metodo_pago",
                    "fecha_pago_registrado",
                    "estado",
                ]
            )
            sena_reiniciada = True
            penalidad_aplicada = not en_ventana

        turno.save(update_fields=update_fields)

        nombre_usuario = getattr(usuario, "full_name", None) or str(usuario)
        observaciones = (
            f"Turno reprogramado de {fecha_hora_anterior.strftime('%d/%m/%Y %H:%M')} "
            f"a {fecha_hora_nueva.strftime('%d/%m/%Y %H:%M')} por {nombre_usuario}. "
            f"Origen: {origen}."
        )
        if empleado_anterior.id != empleado_destino.id:
            observaciones += (
                f" Profesional: {empleado_anterior.nombre_completo} -> "
                f"{empleado_destino.nombre_completo}."
            )
        if sena_reiniciada:
            observaciones += " Se reinicio la seña por reprogramacion de cliente."
        if reiniciar_pago_cliente and en_ventana:
            observaciones += " Reprogramacion dentro de rango permitido: no aplica penalidad adicional."
        if reiniciar_pago_cliente and not en_ventana:
            observaciones += (
                f" Reprogramacion fuera de rango: {mensaje_penalidad} "
                "Estado de pago: seÃ±a pendiente de pago en local."
            )
        if motivo_normalizado:
            observaciones += f" Motivo: {motivo_normalizado}"

        HistorialTurno.objects.create(
            turno=turno,
            usuario=usuario,
            accion="Reprogramacion de turno",
            estado_anterior=turno.estado,
            estado_nuevo=turno.estado,
            origen=origen,
            observaciones=observaciones,
        )

    return ReprogramacionTurnoResult(
        turno=turno,
        fecha_hora_anterior=fecha_hora_anterior,
        fecha_hora_nueva=fecha_hora_nueva,
        sena_reiniciada=sena_reiniciada,
        penalidad_aplicada=penalidad_aplicada,
        brecha_horas=brecha_horas,
        mensaje_penalidad=mensaje_penalidad if penalidad_aplicada else "",
    )
