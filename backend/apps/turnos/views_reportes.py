"""Vistas para reportes y estadísticas"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.core.paginator import Paginator
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncMonth
from datetime import datetime, timedelta, time
from decimal import Decimal
from .models import Turno


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def reportes_finanzas(request):
    """
    Endpoint para obtener datos financieros agregados

    Query params:
    - fecha_desde: Fecha inicio (formato: YYYY-MM-DD)
    - fecha_hasta: Fecha fin (formato: YYYY-MM-DD)
    """

    # Obtener parámetros de fecha
    fecha_desde_str = request.query_params.get("fecha_desde")
    fecha_hasta_str = request.query_params.get("fecha_hasta")

    # Configurar fechas por defecto (últimos 6 meses)
    if fecha_hasta_str:
        fecha_hasta = datetime.strptime(fecha_hasta_str, "%Y-%m-%d").date()
    else:
        fecha_hasta = datetime.now().date()

    if fecha_desde_str:
        fecha_desde = datetime.strptime(fecha_desde_str, "%Y-%m-%d").date()
    else:
        # 6 meses atrás
        fecha_desde = fecha_hasta - timedelta(days=180)

    # Filtrar turnos en el rango de fechas
    turnos_query = Turno.objects.filter(
        fecha_hora__date__gte=fecha_desde, fecha_hora__date__lte=fecha_hasta
    )

    # 1. Ingresos mensuales (solo turnos completados)
    ingresos_mensuales = (
        turnos_query.filter(estado="completado")
        .annotate(mes=TruncMonth("fecha_hora"))
        .values("mes")
        .annotate(total=Sum("precio_final"), cantidad_turnos=Count("id"))
        .order_by("mes")
    )

    # Formatear datos para el frontend
    ingresos_data = []
    for item in ingresos_mensuales:
        ingresos_data.append(
            {
                "mes": item["mes"].strftime("%Y-%m"),
                "mes_nombre": item["mes"].strftime("%B %Y"),
                "total": float(item["total"] or 0),
                "cantidad_turnos": item["cantidad_turnos"],
            }
        )

    # 2. Balance de turnos (completados vs cancelados)
    balance_turnos = turnos_query.aggregate(
        completados=Count("id", filter=Q(estado="completado")),
        cancelados=Count("id", filter=Q(estado="cancelado")),
        no_asistio=Count("id", filter=Q(estado="no_asistio")),
        pendientes=Count("id", filter=Q(estado="pendiente")),
        confirmados=Count("id", filter=Q(estado="confirmado")),
    )

    # 3. Total de ingresos
    total_ingresos = turnos_query.filter(estado="completado").aggregate(
        total=Sum("precio_final")
    )

    # 4. Promedio de ingreso por turno
    if balance_turnos["completados"] > 0:
        promedio_por_turno = (
            float(total_ingresos["total"] or 0) / balance_turnos["completados"]
        )
    else:
        promedio_por_turno = 0

    # 5. Tasa de conversión (completados / total)
    total_turnos = sum(balance_turnos.values())
    if total_turnos > 0:
        tasa_conversion = (balance_turnos["completados"] / total_turnos) * 100
    else:
        tasa_conversion = 0

    # 6. Ingresos por servicio (top 5)
    ingresos_por_servicio = (
        turnos_query.filter(estado="completado")
        .values("servicio__nombre", "servicio__id")
        .annotate(total=Sum("precio_final"), cantidad=Count("id"))
        .order_by("-total")[:5]
    )

    servicios_data = []
    for item in ingresos_por_servicio:
        servicios_data.append(
            {
                "servicio_id": item["servicio__id"],
                "servicio_nombre": item["servicio__nombre"],
                "total": float(item["total"] or 0),
                "cantidad": item["cantidad"],
            }
        )

    # 7. Ingresos por profesional
    ingresos_por_empleado = (
        turnos_query.filter(estado="completado")
        .values(
            "empleado__user__first_name", "empleado__user__last_name", "empleado__id"
        )
        .annotate(total=Sum("precio_final"), cantidad=Count("id"))
        .order_by("-total")
    )

    empleados_data = []
    for item in ingresos_por_empleado:
        empleados_data.append(
            {
                "empleado_id": item["empleado__id"],
                "empleado_nombre": f"{item['empleado__user__first_name']} {item['empleado__user__last_name']}",
                "total": float(item["total"] or 0),
                "cantidad": item["cantidad"],
            }
        )

    return Response(
        {
            "fecha_desde": fecha_desde.isoformat(),
            "fecha_hasta": fecha_hasta.isoformat(),
            "resumen": {
                "total_ingresos": float(total_ingresos["total"] or 0),
                "total_turnos": total_turnos,
                "turnos_completados": balance_turnos["completados"],
                "turnos_cancelados": balance_turnos["cancelados"],
                "turnos_no_asistio": balance_turnos["no_asistio"],
                "promedio_por_turno": round(promedio_por_turno, 2),
                "tasa_conversion": round(tasa_conversion, 2),
            },
            "ingresos_mensuales": ingresos_data,
            "balance_turnos": {
                "completados": balance_turnos["completados"],
                "cancelados": balance_turnos["cancelados"],
                "no_asistio": balance_turnos["no_asistio"],
                "pendientes": balance_turnos["pendientes"],
                "confirmados": balance_turnos["confirmados"],
            },
            "top_servicios": servicios_data,
            "rendimiento_empleados": empleados_data,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def reportes_billetera(request):
    """Endpoint de auditoría financiera y operativa con filtros."""
    from apps.clientes.models import MovimientoBilletera, Billetera
    from apps.emails.models import AccessToken
    from apps.mercadopago.models import PagoMercadoPago
    from apps.servicios.models import Servicio

    fecha_desde_str = request.query_params.get("fecha_desde")
    fecha_hasta_str = request.query_params.get("fecha_hasta")
    accion_filtro = (request.query_params.get("accion") or "todas").lower()
    entidad_filtro = (request.query_params.get("entidad") or "todas").lower()
    actor_filtro = (request.query_params.get("actor") or "").strip().lower()
    status_filtro = (request.query_params.get("status") or "todos").strip().lower()
    sort_by = (request.query_params.get("sort_by") or "fecha_hora").strip().lower()
    sort_dir = (request.query_params.get("sort_dir") or "desc").strip().lower()

    monto_desde_raw = request.query_params.get("monto_desde")
    monto_hasta_raw = request.query_params.get("monto_hasta")

    try:
        page = int(request.query_params.get("page", 1))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = int(request.query_params.get("page_size", 20))
    except (TypeError, ValueError):
        page_size = 20

    if page < 1:
        page = 1
    page_size = max(1, min(page_size, 200))

    try:
        if fecha_hasta_str:
            fecha_hasta = datetime.strptime(fecha_hasta_str, "%Y-%m-%d").date()
        else:
            fecha_hasta = datetime.now().date()

        if fecha_desde_str:
            fecha_desde = datetime.strptime(fecha_desde_str, "%Y-%m-%d").date()
        else:
            fecha_desde = fecha_hasta - timedelta(days=30)
    except ValueError:
        return Response(
            {"error": "Formato de fecha inválido. Use YYYY-MM-DD."}, status=400
        )

    fecha_desde_dt = datetime.combine(fecha_desde, time.min)
    fecha_hasta_dt = datetime.combine(fecha_hasta, time.max)

    movimientos = MovimientoBilletera.objects.filter(
        created_at__date__gte=fecha_desde, created_at__date__lte=fecha_hasta
    ).select_related("billetera__cliente__user")

    pagos_qs = PagoMercadoPago.objects.filter(
        creado_en__date__gte=fecha_desde, creado_en__date__lte=fecha_hasta
    ).select_related("cliente__user", "turno")

    access_tokens_qs = AccessToken.objects.filter(
        created_at__date__gte=fecha_desde, created_at__date__lte=fecha_hasta
    ).select_related("user")

    turno_history_qs = (
        Turno.history.model.objects.filter(
            history_date__gte=fecha_desde_dt,
            history_date__lte=fecha_hasta_dt,
        )
        .select_related("history_user", "cliente__user", "servicio")
        .order_by("-history_date")
    )

    servicio_history_qs = (
        Servicio.history.model.objects.filter(
            history_date__gte=fecha_desde_dt,
            history_date__lte=fecha_hasta_dt,
        )
        .select_related("history_user")
        .order_by("-history_date")
    )

    total_creditos = movimientos.filter(tipo="credito").aggregate(total=Sum("monto"))[
        "total"
    ] or Decimal("0")
    total_debitos = movimientos.filter(tipo="debito").aggregate(total=Sum("monto"))[
        "total"
    ] or Decimal("0")
    total_ingresos = Turno.objects.filter(
        estado="completado",
        fecha_hora__date__gte=fecha_desde,
        fecha_hora__date__lte=fecha_hasta,
    ).aggregate(total=Sum("precio_final"))["total"] or Decimal("0")

    saldo_total = Billetera.objects.aggregate(total=Sum("saldo"))["total"] or Decimal(
        "0"
    )
    billeteras_con_saldo = Billetera.objects.filter(saldo__gt=0).count()

    accion_map = {
        "+": ("insercion", "Inserción"),
        "~": ("modificacion", "Modificación"),
        "-": ("eliminacion", "Eliminación"),
    }

    registros = []

    for mov in movimientos.order_by("-created_at")[:500]:
        cliente = mov.billetera.cliente
        actor = cliente.nombre_completo
        actor_email = cliente.email or ""
        monto = float(mov.monto or 0)
        if mov.tipo == "debito":
            monto = -abs(monto)

        registros.append(
            {
                "id": f"mov-{mov.id}",
                "fecha_hora": mov.created_at.isoformat(),
                "descripcion": mov.descripcion
                or f"Movimiento de billetera ({mov.get_tipo_display()})",
                "monto": monto,
                "status": "Aplicado",
                "entidad": "Usuarios/Crédito",
                "entidad_key": "usuarios_credito",
                "actor": actor,
                "actor_email": actor_email,
                "detalle": f"Saldo: ${mov.saldo_anterior} → ${mov.saldo_nuevo}",
                "accion": "Inserción",
                "accion_key": "insercion",
            }
        )

    for pago in pagos_qs.order_by("-creado_en")[:300]:
        actor = pago.cliente.nombre_completo if pago.cliente else "Sistema"
        actor_email = pago.cliente.email if pago.cliente else ""

        registros.append(
            {
                "id": f"pago-{pago.id}",
                "fecha_hora": pago.creado_en.isoformat(),
                "descripcion": f"Pago MP ({pago.preference_id})",
                "monto": float(pago.monto or 0),
                "status": pago.get_estado_display(),
                "entidad": "Pagos (MP)",
                "entidad_key": "pagos_mp",
                "actor": actor,
                "actor_email": actor_email,
                "detalle": f"Turno #{pago.turno_id}",
                "accion": "Inserción",
                "accion_key": "insercion",
            }
        )

    for token in access_tokens_qs.order_by("-created_at")[:300]:
        actor = token.user.full_name
        actor_email = token.user.email
        if token.used_at:
            estado = "Usado"
        elif token.is_expired:
            estado = "Expirado"
        else:
            estado = "Activo"

        registros.append(
            {
                "id": f"login-{token.id}",
                "fecha_hora": token.created_at.isoformat(),
                "descripcion": "Generación de acceso mágico",
                "monto": None,
                "status": estado,
                "entidad": "Logins (Inicios de Sesión)",
                "entidad_key": "logins",
                "actor": actor,
                "actor_email": actor_email,
                "detalle": token.get_tipo_accion_display(),
                "accion": "Inserción",
                "accion_key": "insercion",
            }
        )

    for record in turno_history_qs[:700]:
        accion_key, accion_label = accion_map.get(
            record.history_type, ("modificacion", "Modificación")
        )
        actor = record.history_user.full_name if record.history_user else "Sistema"
        actor_email = (
            record.history_user.email if record.history_user else "system@local"
        )
        servicio_nombre = record.servicio.nombre if record.servicio else "Sin servicio"

        registros.append(
            {
                "id": f"turno-{record.id}-{record.history_id}",
                "fecha_hora": record.history_date.isoformat(),
                "descripcion": f"Turno #{record.id} · {servicio_nombre}",
                "monto": (
                    float(record.precio_final)
                    if record.precio_final is not None
                    else None
                ),
                "status": (record.estado or "").replace("_", " ").title() or "N/A",
                "entidad": "Turnos",
                "entidad_key": "turnos",
                "actor": actor,
                "actor_email": actor_email,
                "detalle": record.history_change_reason or "Cambio en turno",
                "accion": accion_label,
                "accion_key": accion_key,
            }
        )

    for record in servicio_history_qs[:400]:
        accion_key, accion_label = accion_map.get(
            record.history_type, ("modificacion", "Modificación")
        )
        actor = record.history_user.full_name if record.history_user else "Sistema"
        actor_email = (
            record.history_user.email if record.history_user else "system@local"
        )

        registros.append(
            {
                "id": f"servicio-{record.id}-{record.history_id}",
                "fecha_hora": record.history_date.isoformat(),
                "descripcion": f"Servicio · {record.nombre}",
                "monto": float(record.precio) if record.precio is not None else None,
                "status": (
                    "Activo" if getattr(record, "is_active", False) else "Inactivo"
                ),
                "entidad": "Servicios",
                "entidad_key": "servicios",
                "actor": actor,
                "actor_email": actor_email,
                "detalle": record.history_change_reason or "Cambio en servicio",
                "accion": accion_label,
                "accion_key": accion_key,
            }
        )

    registros = sorted(registros, key=lambda item: item["fecha_hora"], reverse=True)

    if accion_filtro != "todas":
        registros = [item for item in registros if item["accion_key"] == accion_filtro]

    if entidad_filtro != "todas":
        registros = [
            item for item in registros if item["entidad_key"] == entidad_filtro
        ]

    if actor_filtro:
        registros = [
            item
            for item in registros
            if actor_filtro in item["actor"].lower()
            or actor_filtro in item["actor_email"].lower()
        ]

    if status_filtro != "todos":
        registros = [
            item
            for item in registros
            if (item.get("status") or "").strip().lower() == status_filtro
        ]

    monto_desde = None
    monto_hasta = None
    if monto_desde_raw not in (None, ""):
        try:
            monto_desde = float(monto_desde_raw)
        except (TypeError, ValueError):
            return Response({"error": "monto_desde inválido"}, status=400)

    if monto_hasta_raw not in (None, ""):
        try:
            monto_hasta = float(monto_hasta_raw)
        except (TypeError, ValueError):
            return Response({"error": "monto_hasta inválido"}, status=400)

    if monto_desde is not None:
        registros = [
            item
            for item in registros
            if item.get("monto") is not None and float(item["monto"]) >= monto_desde
        ]

    if monto_hasta is not None:
        registros = [
            item
            for item in registros
            if item.get("monto") is not None and float(item["monto"]) <= monto_hasta
        ]

    if sort_by not in {"fecha_hora", "monto", "status"}:
        sort_by = "fecha_hora"
    if sort_dir not in {"asc", "desc"}:
        sort_dir = "desc"

    reverse = sort_dir == "desc"
    if sort_by == "fecha_hora":
        registros = sorted(
            registros, key=lambda item: item["fecha_hora"], reverse=reverse
        )
    elif sort_by == "monto":

        def monto_key(item):
            monto = item.get("monto")
            return float(monto) if monto is not None else float("-inf")

        registros = sorted(registros, key=monto_key, reverse=reverse)
    else:  # status
        registros = sorted(
            registros,
            key=lambda item: (item.get("status") or "").lower(),
            reverse=reverse,
        )

    paginator = Paginator(registros, page_size)
    page_obj = paginator.get_page(page)

    return Response(
        {
            "fecha_desde": fecha_desde.isoformat(),
            "fecha_hasta": fecha_hasta.isoformat(),
            "resumen": {
                "total_registros": len(registros),
                "ingresos_totales": float(total_ingresos),
                "creditos_bonos_usados": float(total_debitos),
                "balance_neto": float(total_ingresos - total_debitos),
                "total_creditos": float(total_creditos),
                "total_debitos": float(total_debitos),
                "saldo_total_sistema": float(saldo_total),
                "billeteras_activas": billeteras_con_saldo,
                "total_movimientos": movimientos.count(),
            },
            "filtros": {
                "acciones": [
                    {"value": "todas", "label": "Todas las acciones"},
                    {"value": "insercion", "label": "Inserción"},
                    {"value": "modificacion", "label": "Modificación"},
                    {"value": "eliminacion", "label": "Eliminación"},
                ],
                "entidades": [
                    {"value": "todas", "label": "Todas las entidades"},
                    {"value": "turnos", "label": "Turnos"},
                    {"value": "usuarios_credito", "label": "Usuarios/Crédito"},
                    {"value": "pagos_mp", "label": "Pagos (MP)"},
                    {"value": "logins", "label": "Logins (Inicios de Sesión)"},
                    {"value": "servicios", "label": "Servicios"},
                ],
            },
            "paginacion": {
                "current_page": page_obj.number,
                "page_size": page_size,
                "total_pages": paginator.num_pages,
                "total_items": paginator.count,
                "has_next": page_obj.has_next(),
                "has_previous": page_obj.has_previous(),
            },
            "orden": {
                "sort_by": sort_by,
                "sort_dir": sort_dir,
            },
            "registros": list(page_obj),
        }
    )
