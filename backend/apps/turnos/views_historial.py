"""Vistas para el historial consolidado del sistema."""

from django.core.paginator import Paginator
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.clientes.models import Cliente
from apps.emails.models import Notificacion
from apps.empleados.models import Empleado
from apps.servicios.models import Servicio
from apps.turnos.models import LogReasignacion, Turno


def _serialize_history_user(history_user):
    if history_user:
        return {
            "id": history_user.id,
            "nombre": history_user.full_name,
            "email": history_user.email,
        }
    return {"id": None, "nombre": "Sistema", "email": "system@local"}


def _build_model_history(modelo_tipo=None, objeto_id=None):
    registros = []

    if not modelo_tipo or modelo_tipo == "turno":
        turno_history = Turno.history.select_related("history_user").all()
        if objeto_id:
            turno_history = turno_history.filter(id=objeto_id)

        for record in turno_history:
            registros.append(
                {
                    "id": record.history_id,
                    "modelo": "Turno",
                    "objeto_id": record.id,
                    "accion": record.get_history_type_display(),
                    "history_type": record.history_type,
                    "usuario": _serialize_history_user(record.history_user),
                    "fecha": record.history_date.isoformat(),
                    "cambio_razon": record.history_change_reason or "",
                    "datos": {
                        "cliente_id": record.cliente_id,
                        "empleado_id": record.empleado_id,
                        "servicio_id": record.servicio_id,
                        "fecha_hora": (
                            record.fecha_hora.isoformat() if record.fecha_hora else None
                        ),
                        "estado": record.estado,
                        "precio_final": (
                            str(record.precio_final) if record.precio_final else None
                        ),
                        "notas_cliente": record.notas_cliente,
                        "notas_empleado": record.notas_empleado,
                    },
                }
            )

    if not modelo_tipo or modelo_tipo == "servicio":
        servicio_history = Servicio.history.select_related("history_user").all()
        if objeto_id:
            servicio_history = servicio_history.filter(id=objeto_id)

        for record in servicio_history:
            registros.append(
                {
                    "id": record.history_id,
                    "modelo": "Servicio",
                    "objeto_id": record.id,
                    "accion": record.get_history_type_display(),
                    "history_type": record.history_type,
                    "usuario": _serialize_history_user(record.history_user),
                    "fecha": record.history_date.isoformat(),
                    "cambio_razon": record.history_change_reason or "",
                    "datos": {
                        "nombre": record.nombre,
                        "categoria_id": record.categoria_id,
                        "precio": str(record.precio),
                        "duracion_minutos": record.duracion_minutos,
                        "is_active": record.is_active,
                    },
                }
            )

    if not modelo_tipo or modelo_tipo == "cliente":
        cliente_history = Cliente.history.select_related("history_user").all()
        if objeto_id:
            cliente_history = cliente_history.filter(id=objeto_id)

        for record in cliente_history:
            registros.append(
                {
                    "id": record.history_id,
                    "modelo": "Cliente",
                    "objeto_id": record.id,
                    "accion": record.get_history_type_display(),
                    "history_type": record.history_type,
                    "usuario": _serialize_history_user(record.history_user),
                    "fecha": record.history_date.isoformat(),
                    "cambio_razon": record.history_change_reason or "",
                    "datos": {
                        "user_id": record.user_id,
                        "is_vip": record.is_vip,
                        "direccion": record.direccion,
                        "preferencias": record.preferencias,
                    },
                }
            )

    registros.sort(key=lambda x: x["fecha"], reverse=True)
    return registros


def _build_fidelizacion_history(filtro_dias=None, objeto_id=None):
    notificaciones = (
        Notificacion.objects.filter(tipo="fidelizacion")
        .select_related("usuario")
        .order_by("-created_at")
    )

    registros = []
    dias_disponibles = set()

    for notificacion in notificaciones:
        data = notificacion.data or {}
        cliente_id = data.get("cliente_id") or objeto_id
        servicio_id = data.get("servicio_id")
        empleado_id = data.get("empleado_id")

        if (
            objeto_id
            and str(notificacion.usuario_id) != str(objeto_id)
            and str(cliente_id or "") != str(objeto_id)
        ):
            continue

        servicio = None
        if servicio_id:
            servicio = (
                Servicio.objects.filter(pk=servicio_id)
                .select_related("categoria")
                .first()
            )

        empleado = None
        if empleado_id:
            empleado = (
                Empleado.objects.select_related("user").filter(pk=empleado_id).first()
            )

        dias_programados = None
        if servicio:
            dias_programados = servicio.frecuencia_recurrencia_dias or 30
            dias_disponibles.add(dias_programados)

        if filtro_dias and dias_programados != filtro_dias:
            continue

        fecha_ultimo_turno = data.get("fecha_ultimo_turno")
        dias_inactividad = None
        if fecha_ultimo_turno:
            try:
                fecha_ref = timezone.datetime.fromisoformat(
                    fecha_ultimo_turno.replace("Z", "+00:00")
                )
                dias_inactividad = (timezone.now() - fecha_ref).days
            except Exception:
                dias_inactividad = None

        registros.append(
            {
                "id": notificacion.id,
                "fecha": notificacion.created_at.isoformat(),
                "cliente": {
                    "id": notificacion.usuario_id,
                    "nombre": notificacion.usuario.full_name,
                    "email": notificacion.usuario.email,
                },
                "titulo": notificacion.titulo,
                "mensaje": notificacion.mensaje,
                "tipo_email": data.get("tipo_email"),
                "servicio": {
                    "id": servicio.id if servicio else servicio_id,
                    "nombre": servicio.nombre if servicio else "Servicio desconocido",
                    "categoria": (
                        servicio.categoria.nombre
                        if servicio and servicio.categoria
                        else None
                    ),
                },
                "profesional": {
                    "id": empleado_id,
                    "nombre": (
                        empleado.nombre_completo
                        if empleado
                        else "Profesional desconocido"
                    ),
                },
                "fecha_ultimo_turno": fecha_ultimo_turno,
                "fecha_sugerida": data.get("fecha_sugerida"),
                "dias_programados": dias_programados,
                "dias_inactividad": dias_inactividad,
                "leida": notificacion.leida,
            }
        )

    return registros, sorted(dias_disponibles)


def _build_reacomodamiento_history(objeto_id=None):
    logs = LogReasignacion.objects.select_related(
        "turno_cancelado__servicio",
        "turno_cancelado__empleado__user",
        "turno_ofrecido",
        "cliente_notificado__user",
    ).order_by("-fecha_envio")

    if objeto_id:
        logs = logs.filter(
            Q(turno_cancelado_id=objeto_id)
            | Q(turno_ofrecido_id=objeto_id)
            | Q(cliente_notificado_id=objeto_id)
        )

    registros = []
    for log in logs:
        turno_cancelado = log.turno_cancelado
        turno_ofrecido = log.turno_ofrecido
        servicio = turno_cancelado.servicio if turno_cancelado else None
        empleado = turno_cancelado.empleado if turno_cancelado else None

        registros.append(
            {
                "id": log.id,
                "fecha": log.fecha_envio.isoformat(),
                "estado_final": log.estado_final or "pendiente",
                "expira": log.expires_at.isoformat() if log.expires_at else None,
                "monto_descuento": str(log.monto_descuento),
                "turno_cancelado": {
                    "id": turno_cancelado.id if turno_cancelado else None,
                    "fecha_hora": (
                        turno_cancelado.fecha_hora.isoformat()
                        if turno_cancelado and turno_cancelado.fecha_hora
                        else None
                    ),
                    "estado": turno_cancelado.estado if turno_cancelado else None,
                },
                "turno_ofrecido": {
                    "id": turno_ofrecido.id if turno_ofrecido else None,
                    "fecha_hora": (
                        turno_ofrecido.fecha_hora.isoformat()
                        if turno_ofrecido and turno_ofrecido.fecha_hora
                        else None
                    ),
                    "estado": turno_ofrecido.estado if turno_ofrecido else None,
                },
                "cliente_notificado": {
                    "id": log.cliente_notificado_id,
                    "nombre": log.cliente_notificado.nombre_completo,
                    "email": log.cliente_notificado.email,
                },
                "servicio": {
                    "id": servicio.id if servicio else None,
                    "nombre": servicio.nombre if servicio else "Servicio desconocido",
                },
                "profesional": {
                    "id": empleado.id if empleado else None,
                    "nombre": (
                        empleado.nombre_completo
                        if empleado
                        else "Profesional desconocido"
                    ),
                },
            }
        )

    return registros


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_historial(request):
    """Lista el historial consolidado de cambios manuales y procesos automáticos."""
    if request.user.role not in ["propietario", "superusuario"]:
        return Response(
            {"error": "No tienes permisos para ver el historial"},
            status=status.HTTP_403_FORBIDDEN,
        )

    modelo_tipo = request.query_params.get("modelo", None)
    objeto_id = request.query_params.get("objeto_id", None)
    seccion = request.query_params.get("seccion", "todas")
    filtro_dias_fidelizacion = request.query_params.get("dias_fidelizacion")
    page = int(request.query_params.get("page", 1))
    page_size = int(request.query_params.get("page_size", 50))

    dias_fidelizacion = None
    if filtro_dias_fidelizacion:
        try:
            dias_fidelizacion = int(filtro_dias_fidelizacion)
        except ValueError:
            return Response(
                {"error": "El filtro de días de fidelización debe ser numérico"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    historial_modelos = []
    if seccion in ["todas", "modelos"]:
        historial_modelos = _build_model_history(
            modelo_tipo=modelo_tipo, objeto_id=objeto_id
        )

    paginator = Paginator(historial_modelos, page_size)
    page_obj = paginator.get_page(page)

    fidelizacion = []
    dias_disponibles = []
    if seccion in ["todas", "fidelizacion"]:
        fidelizacion, dias_disponibles = _build_fidelizacion_history(
            filtro_dias=dias_fidelizacion,
            objeto_id=objeto_id,
        )

    reacomodamiento = []
    if seccion in ["todas", "reacomodamiento"]:
        reacomodamiento = _build_reacomodamiento_history(objeto_id=objeto_id)

    return Response(
        {
            "count": paginator.count + len(fidelizacion) + len(reacomodamiento),
            "seccion": seccion,
            "resumen": {
                "cambios_modelos": paginator.count,
                "fidelizacion": len(fidelizacion),
                "reacomodamiento": len(reacomodamiento),
                "total": paginator.count + len(fidelizacion) + len(reacomodamiento),
            },
            "modelos": {
                "count": paginator.count,
                "next": page_obj.has_next(),
                "previous": page_obj.has_previous(),
                "total_pages": paginator.num_pages,
                "current_page": page,
                "results": list(page_obj),
            },
            "automatizaciones": {
                "fidelizacion": {
                    "count": len(fidelizacion),
                    "dias_disponibles": dias_disponibles,
                    "filtro_dias": dias_fidelizacion,
                    "results": fidelizacion,
                },
                "reacomodamiento": {
                    "count": len(reacomodamiento),
                    "results": reacomodamiento,
                },
            },
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def detalle_historial(request, modelo, history_id):
    """
    Obtiene el detalle de un registro histórico específico.
    """
    if request.user.role not in ["propietario", "superusuario"]:
        return Response(
            {"error": "No tienes permisos para ver el historial"},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        if modelo == "turno":
            record = Turno.history.select_related("history_user").get(
                history_id=history_id
            )
            datos = {
                "cliente_id": record.cliente_id,
                "empleado_id": record.empleado_id,
                "servicio_id": record.servicio_id,
                "fecha_hora": (
                    record.fecha_hora.isoformat() if record.fecha_hora else None
                ),
                "estado": record.estado,
                "precio_final": (
                    str(record.precio_final) if record.precio_final else None
                ),
                "senia_pagada": (
                    str(record.senia_pagada) if record.senia_pagada else None
                ),
                "notas_cliente": record.notas_cliente,
                "notas_empleado": record.notas_empleado,
            }
        elif modelo == "servicio":
            record = Servicio.history.select_related("history_user").get(
                history_id=history_id
            )
            datos = {
                "nombre": record.nombre,
                "descripcion": record.descripcion,
                "categoria_id": record.categoria_id,
                "precio": str(record.precio),
                "duracion_minutos": record.duracion_minutos,
                "descuento_reasignacion": (
                    str(record.descuento_reasignacion)
                    if record.descuento_reasignacion
                    else None
                ),
                "permite_reacomodamiento": record.permite_reacomodamiento,
                "is_active": record.is_active,
            }
        elif modelo == "cliente":
            record = Cliente.history.select_related("history_user").get(
                history_id=history_id
            )
            datos = {
                "user_id": record.user_id,
                "fecha_nacimiento": (
                    record.fecha_nacimiento.isoformat()
                    if record.fecha_nacimiento
                    else None
                ),
                "direccion": record.direccion,
                "preferencias": record.preferencias,
                "is_vip": record.is_vip,
            }
        else:
            return Response(
                {"error": "Modelo no válido"}, status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            {
                "id": record.history_id,
                "modelo": modelo.capitalize(),
                "objeto_id": record.id,
                "accion": record.get_history_type_display(),
                "history_type": record.history_type,
                "usuario": (
                    {
                        "id": record.history_user.id if record.history_user else None,
                        "nombre": (
                            record.history_user.full_name
                            if record.history_user
                            else "Sistema"
                        ),
                        "email": (
                            record.history_user.email
                            if record.history_user
                            else "system@local"
                        ),
                    }
                    if record.history_user
                    else {"nombre": "Sistema", "email": "system@local"}
                ),
                "fecha": record.history_date.isoformat(),
                "cambio_razon": record.history_change_reason or "",
                "datos": datos,
            }
        )

    except Exception as e:
        return Response(
            {"error": f"Registro no encontrado: {str(e)}"},
            status=status.HTTP_404_NOT_FOUND,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def restaurar_desde_historial(request, modelo, history_id):
    """
    Restaura un objeto a una versión anterior del historial.
    """
    if request.user.role not in ["propietario", "superusuario"]:
        return Response(
            {"error": "No tienes permisos para restaurar desde el historial"},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        if modelo == "turno":
            from apps.turnos.utils import restaurar_turno_desde_historial

            turno = restaurar_turno_desde_historial(history_id, request.user)
            return Response(
                {
                    "success": True,
                    "message": f"Turno {turno.id} restaurado exitosamente",
                    "turno_id": turno.id,
                }
            )
        else:
            return Response(
                {
                    "error": "La restauración solo está implementada para Turnos actualmente"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    except Exception as e:
        return Response(
            {"error": f"Error restaurando desde historial: {str(e)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )
