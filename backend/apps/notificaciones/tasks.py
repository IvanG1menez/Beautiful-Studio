"""
Tareas asíncronas de Celery para notificaciones
"""
from celery import shared_task
from django.utils import timezone
from django.db.models import Count, Sum, Q
from datetime import timedelta, datetime
import logging

logger = logging.getLogger(__name__)


@shared_task(name='apps.notificaciones.tasks.enviar_recordatorios_turnos')
def enviar_recordatorios_turnos():
    """
    Tarea programada para enviar recordatorios de turnos
    Se ejecuta diariamente a las 9:00 AM
    Envía recordatorios de turnos que ocurrirán en las próximas 24 horas
    """
    from apps.turnos.models import Turno
    from apps.notificaciones.models import NotificacionConfig
    from apps.notificaciones.services import EmailService
    
    logger.info("Iniciando envío de recordatorios de turnos...")
    
    try:
        # Calcular ventana de tiempo (próximas 24 horas)
        ahora = timezone.now()
        manana = ahora + timedelta(hours=24)
        
        # Obtener turnos confirmados en las próximas 24 horas
        turnos = Turno.objects.filter(
            fecha_hora__gte=ahora,
            fecha_hora__lte=manana,
            estado__in=['pendiente', 'confirmado']
        ).select_related('empleado__user', 'cliente', 'servicio')
        
        emails_enviados = 0
        emails_fallidos = 0
        
        for turno in turnos:
            # Verificar configuración del profesional
            config, _ = NotificacionConfig.objects.get_or_create(
                user=turno.empleado.user,
                defaults={'email_recordatorio_turno': True}
            )
            
            if config.email_recordatorio_turno:
                try:
                    if EmailService.enviar_email_recordatorio_turno(turno):
                        emails_enviados += 1
                    else:
                        emails_fallidos += 1
                except Exception as e:
                    logger.error(f"Error enviando recordatorio para turno {turno.id}: {str(e)}")
                    emails_fallidos += 1
        
        logger.info(f"Recordatorios enviados: {emails_enviados}, fallidos: {emails_fallidos}")
        
        return {
            'turnos_procesados': turnos.count(),
            'emails_enviados': emails_enviados,
            'emails_fallidos': emails_fallidos
        }
        
    except Exception as e:
        logger.error(f"Error en tarea de recordatorios: {str(e)}")
        raise


@shared_task(name='apps.notificaciones.tasks.enviar_reporte_diario_propietarios')
def enviar_reporte_diario_propietarios():
    """
    Tarea programada para enviar reporte diario a propietarios
    Se ejecuta diariamente a las 8:00 PM
    Incluye estadísticas del día: turnos, ingresos, nuevos clientes
    """
    from apps.turnos.models import Turno
    from apps.clientes.models import Cliente
    from apps.users.models import User
    from apps.notificaciones.models import NotificacionConfig
    from apps.notificaciones.services import EmailService
    
    logger.info("Iniciando envío de reporte diario...")
    
    try:
        # Calcular rango del día actual
        hoy = timezone.now().date()
        inicio_dia = timezone.make_aware(datetime.combine(hoy, datetime.min.time()))
        fin_dia = timezone.make_aware(datetime.combine(hoy, datetime.max.time()))
        
        # Estadísticas del día
        turnos_hoy = Turno.objects.filter(
            fecha_hora__range=(inicio_dia, fin_dia)
        )
        
        turnos_completados = turnos_hoy.filter(estado='completado').count()
        turnos_cancelados = turnos_hoy.filter(estado='cancelado').count()
        turnos_pendientes = turnos_hoy.filter(
            estado__in=['pendiente', 'confirmado']
        ).count()
        
        # Calcular ingresos (turnos completados con precio)
        ingresos_totales = turnos_hoy.filter(
            estado='completado'
        ).aggregate(
            total=Sum('precio_final')
        )['total'] or 0
        
        # Si no hay precio_final, sumar el precio del servicio
        if ingresos_totales == 0:
            ingresos_totales = turnos_hoy.filter(
                estado='completado'
            ).aggregate(
                total=Sum('servicio__precio')
            )['total'] or 0
        
        # Nuevos clientes del día
        nuevos_clientes = Cliente.objects.filter(
            user__created_at__range=(inicio_dia, fin_dia)
        ).count()
        
        # Preparar datos del reporte
        datos_reporte = {
            'turnos_completados': turnos_completados,
            'turnos_cancelados': turnos_cancelados,
            'turnos_pendientes': turnos_pendientes,
            'ingresos_totales': float(ingresos_totales),
            'nuevos_clientes': nuevos_clientes,
        }
        
        # Obtener propietarios con email de reporte activado
        propietarios = User.objects.filter(role='propietario')
        
        emails_enviados = 0
        for propietario in propietarios:
            config, _ = NotificacionConfig.objects.get_or_create(
                user=propietario,
                defaults={'email_reporte_diario': True}
            )
            
            if config.email_reporte_diario:
                try:
                    if EmailService.enviar_email_reporte_diario_propietario(datos_reporte):
                        emails_enviados += 1
                except Exception as e:
                    logger.error(f"Error enviando reporte a {propietario.email}: {str(e)}")
        
        logger.info(f"Reportes diarios enviados: {emails_enviados}")
        
        return {
            'propietarios_notificados': emails_enviados,
            'datos_reporte': datos_reporte
        }
        
    except Exception as e:
        logger.error(f"Error en tarea de reporte diario: {str(e)}")
        raise


@shared_task(name='apps.notificaciones.tasks.limpiar_notificaciones_antiguas')
def limpiar_notificaciones_antiguas(dias=90):
    """
    Tarea opcional para limpiar notificaciones antiguas
    Por defecto elimina notificaciones leídas con más de 90 días
    """
    from apps.notificaciones.models import Notificacion
    
    logger.info(f"Limpiando notificaciones antiguas (>{dias} días)...")
    
    try:
        fecha_limite = timezone.now() - timedelta(days=dias)
        
        # Eliminar notificaciones leídas antiguas
        notificaciones_eliminadas = Notificacion.objects.filter(
            leida=True,
            leida_at__lt=fecha_limite
        ).delete()
        
        logger.info(f"Notificaciones eliminadas: {notificaciones_eliminadas[0]}")
        
        return {
            'notificaciones_eliminadas': notificaciones_eliminadas[0]
        }
        
    except Exception as e:
        logger.error(f"Error limpiando notificaciones: {str(e)}")
        raise
