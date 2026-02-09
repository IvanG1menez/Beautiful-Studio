"""
Vistas para el historial de cambios usando django-simple-history
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.contenttypes.models import ContentType
from django.core.paginator import Paginator

from apps.turnos.models import Turno
from apps.servicios.models import Servicio
from apps.clientes.models import Cliente


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_historial(request):
    """
    Lista el historial de cambios de todos los modelos con tracking.
    Solo accesible para propietarios/superusuarios.
    """
    if request.user.role not in ["propietario", "superusuario"]:
        return Response(
            {"error": "No tienes permisos para ver el historial"},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Parámetros de filtrado
    modelo_tipo = request.query_params.get("modelo", None)
    objeto_id = request.query_params.get("objeto_id", None)
    page = int(request.query_params.get("page", 1))
    page_size = int(request.query_params.get("page_size", 50))

    # Obtener registros históricos
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
                    "usuario": (
                        {
                            "id": (
                                record.history_user.id if record.history_user else None
                            ),
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
                    "usuario": (
                        {
                            "id": (
                                record.history_user.id if record.history_user else None
                            ),
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
                    "usuario": (
                        {
                            "id": (
                                record.history_user.id if record.history_user else None
                            ),
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
                    "datos": {
                        "user_id": record.user_id,
                        "is_vip": record.is_vip,
                        "direccion": record.direccion,
                        "preferencias": record.preferencias,
                    },
                }
            )

    # Ordenar por fecha descendente
    registros.sort(key=lambda x: x["fecha"], reverse=True)

    # Paginar
    paginator = Paginator(registros, page_size)
    page_obj = paginator.get_page(page)

    return Response(
        {
            "count": paginator.count,
            "next": page_obj.has_next(),
            "previous": page_obj.has_previous(),
            "total_pages": paginator.num_pages,
            "current_page": page,
            "results": list(page_obj),
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
