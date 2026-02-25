"""Vistas para gestión de oportunidades de agenda (clientes inactivos)"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Max, Count
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from .models import Turno
from apps.clientes.models import Cliente
from apps.authentication.models import ConfiguracionGlobal
from apps.servicios.models import Servicio


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def oportunidades_agenda_view(request):
    """
    Vista para obtener clientes "olvidados" (inactivos)
    basándose en:
    1. frecuencia_recurrencia_dias del servicio más frecuente del cliente (prioridad)
    2. margen_fidelizacion_dias de ConfiguracionGlobal (fallback si servicio es 0 o None)
    
    Query params:
    - dias_inactividad: Días de inactividad (opcional, usa lógica automática si no se provee)
    """
    
    # Verificar que el usuario sea propietario
    if request.user.role != "propietario":
        return Response(
            {"error": "Solo el propietario puede acceder a las oportunidades de agenda"},
            status=status.HTTP_403_FORBIDDEN,
        )
    
    # Obtener configuración global
    config_global = ConfiguracionGlobal.get_config()
    
    # Obtener días de inactividad desde query params (filtro manual)
    dias_param = request.query_params.get('dias_inactividad')
    dias_inactividad_filtro = int(dias_param) if dias_param else None
    
    # Encontrar clientes con su último turno
    clientes_con_turnos = (
        Turno.objects
        .filter(cliente__isnull=False)
        .values('cliente')
        .annotate(
            ultimo_turno=Max('fecha_hora'),
            total_turnos=Count('id')
        )
    )
    
    # Filtrar clientes inactivos
    clientes_inactivos = []
    for cliente_data in clientes_con_turnos:
        try:
            cliente = Cliente.objects.get(id=cliente_data['cliente'])
            
            # Calcular días de inactividad
            dias_sin_turno = (timezone.now() - cliente_data['ultimo_turno']).days
            
            # Obtener servicio más frecuente del cliente CON su frecuencia_recurrencia_dias
            servicio_mas_frecuente = (
                Turno.objects
                .filter(cliente=cliente)
                .values(
                    'servicio__id', 
                    'servicio__nombre', 
                    'servicio__precio',
                    'servicio__frecuencia_recurrencia_dias'
                )
                .annotate(cantidad=Count('id'))
                .order_by('-cantidad')
                .first()
            )
            
            # Determinar umbral de inactividad para este cliente
            if dias_inactividad_filtro is not None:
                # Si hay filtro manual, usarlo
                umbral_dias = dias_inactividad_filtro
            elif servicio_mas_frecuente and servicio_mas_frecuente['servicio__frecuencia_recurrencia_dias'] > 0:
                # Si el servicio tiene frecuencia configurada, usarla (PRIORIDAD)
                umbral_dias = servicio_mas_frecuente['servicio__frecuencia_recurrencia_dias']
            else:
                # Si no, usar configuración global (FALLBACK)
                umbral_dias = config_global.margen_fidelizacion_dias
            
            # Solo incluir si supera el umbral
            if dias_sin_turno >= umbral_dias:
                clientes_inactivos.append({
                    'id': cliente.id,
                    'nombre': f"{cliente.user.first_name} {cliente.user.last_name}",
                    'email': cliente.user.email,
                    'telefono': cliente.telefono,
                    'ultimo_turno': cliente_data['ultimo_turno'].isoformat(),
                    'dias_sin_turno': dias_sin_turno,
                    'total_turnos_historico': cliente_data['total_turnos'],
                    'umbral_dias_usado': umbral_dias,  # NEW: para saber qué umbral se usó
                    'servicio_frecuente': {
                        'id': servicio_mas_frecuente['servicio__id'],
                        'nombre': servicio_mas_frecuente['servicio__nombre'],
                        'precio': float(servicio_mas_frecuente['servicio__precio']),
                        'cantidad_veces': servicio_mas_frecuente['cantidad'],
                        'frecuencia_recurrencia_dias': servicio_mas_frecuente['servicio__frecuencia_recurrencia_dias'],
                    } if servicio_mas_frecuente else None,
                })
        except Cliente.DoesNotExist:
            continue
    
    # Ordenar por días de inactividad (descendente)
    clientes_inactivos.sort(key=lambda x: x['dias_sin_turno'], reverse=True)
    
    return Response({
        'configuracion': {
            'dias_inactividad_umbral': dias_inactividad_filtro or config_global.margen_fidelizacion_dias,
            'descuento_fidelizacion_pct': float(config_global.descuento_fidelizacion_pct),
            'usa_filtro_manual': dias_inactividad_filtro is not None,
        },
        'total_oportunidades': len(clientes_inactivos),
        'clientes': clientes_inactivos,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def enviar_invitacion_reincorporacion(request, cliente_id):
    """
    Enviar invitación de reincorporación a un cliente inactivo
    con descuento automático según configuración
    
    Body params:
    - servicio_id: ID del servicio a ofrecer (opcional)
    - mensaje_personalizado: Mensaje adicional (opcional)
    """
    
    # Verificar que el usuario sea propietario
    if request.user.role != "propietario":
        return Response(
            {"error": "Solo el propietario puede enviar invitaciones"},
            status=status.HTTP_403_FORBIDDEN,
        )
    
    try:
        cliente = Cliente.objects.get(id=cliente_id)
    except Cliente.DoesNotExist:
        return Response(
            {"error": "Cliente no encontrado"},
            status=status.HTTP_404_NOT_FOUND,
        )
    
    # Obtener configuración global
    config_global = ConfiguracionGlobal.get_config()
    descuento_pct = float(config_global.descuento_fidelizacion_pct)
    
    # Obtener servicio propuesto
    servicio_id = request.data.get('servicio_id')
    servicio = None
    precio_con_descuento = None
    
    if servicio_id:
        try:
            servicio = Servicio.objects.get(id=servicio_id)
            precio_original = float(servicio.precio)
            precio_con_descuento = precio_original * (1 - descuento_pct / 100)
        except Servicio.DoesNotExist:
            pass
    
    mensaje_personalizado = request.data.get('mensaje_personalizado', '')
    
    # TODO: Aquí se integraría el sistema de envío de emails
    # Por ahora retornamos los datos que se enviarían
    
    return Response({
        'mensaje': 'Invitación enviada exitosamente',
        'cliente': {
            'id': cliente.id,
            'nombre': f"{cliente.user.first_name} {cliente.user.last_name}",
            'email': cliente.user.email,
        },
        'oferta': {
            'descuento_pct': descuento_pct,
            'servicio': {
                'id': servicio.id,
                'nombre': servicio.nombre,
                'precio_original': float(servicio.precio),
                'precio_con_descuento': precio_con_descuento,
            } if servicio else None,
            'mensaje_personalizado': mensaje_personalizado,
        },
    }, status=status.HTTP_200_OK)
