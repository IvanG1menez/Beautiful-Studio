"""Vistas para reportes y estadísticas"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncMonth
from datetime import datetime, timedelta
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
    """
    Endpoint para auditoría de movimientos de billetera
    """
    from apps.clientes.models import MovimientoBilletera, Billetera

    # Obtener parámetros
    fecha_desde_str = request.query_params.get("fecha_desde")
    fecha_hasta_str = request.query_params.get("fecha_hasta")

    # Configurar fechas
    if fecha_hasta_str:
        fecha_hasta = datetime.strptime(fecha_hasta_str, "%Y-%m-%d").date()
    else:
        fecha_hasta = datetime.now().date()

    if fecha_desde_str:
        fecha_desde = datetime.strptime(fecha_desde_str, "%Y-%m-%d").date()
    else:
        fecha_desde = fecha_hasta - timedelta(days=30)

    # Movimientos en el periodo
    movimientos = MovimientoBilletera.objects.filter(
        created_at__date__gte=fecha_desde, created_at__date__lte=fecha_hasta
    )

    # Agregaciones
    total_creditos = movimientos.filter(tipo="credito").aggregate(total=Sum("monto"))[
        "total"
    ] or Decimal("0")

    total_debitos = movimientos.filter(tipo="debito").aggregate(total=Sum("monto"))[
        "total"
    ] or Decimal("0")

    # Saldo total en billeteras
    saldo_total = Billetera.objects.aggregate(total=Sum("saldo"))["total"] or Decimal(
        "0"
    )

    # Cantidad de billeteras con saldo
    billeteras_con_saldo = Billetera.objects.filter(saldo__gt=0).count()

    return Response(
        {
            "fecha_desde": fecha_desde.isoformat(),
            "fecha_hasta": fecha_hasta.isoformat(),
            "resumen": {
                "total_creditos": float(total_creditos),
                "total_debitos": float(total_debitos),
                "saldo_total_sistema": float(saldo_total),
                "billeteras_activas": billeteras_con_saldo,
                "total_movimientos": movimientos.count(),
            },
        }
    )
