"""
Tareas asíncronas para el procesamiento de encuestas
"""

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Avg, F
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


@shared_task
def procesar_resultado_encuesta(encuesta_id):
    """
    Procesar el resultado de una encuesta:
    1. Actualizar ranking del empleado (promedio_calificacion, total_encuestas)
    2. Verificar umbral de alertas y notificar al propietario si es necesario
    
    Args:
        encuesta_id: ID de la encuesta a procesar
    """
    from apps.encuestas.models import Encuesta, EncuestaConfig
    from apps.empleados.models import Empleado
    
    try:
        encuesta = Encuesta.objects.select_related('empleado', 'cliente', 'turno').get(id=encuesta_id)
        
        # Evitar procesamiento duplicado
        if encuesta.procesada:
            logger.info(f"Encuesta {encuesta_id} ya fue procesada. Saltando.")
            return
        
        empleado = encuesta.empleado
        
        # 1. ACTUALIZACIÓN DE RANKING
        with transaction.atomic():
            # Recalcular promedio de todas las encuestas del empleado
            promedio_actual = Encuesta.objects.filter(
                empleado=empleado
            ).aggregate(promedio=Avg('puntaje'))['promedio'] or 5.0
            
            total_encuestas = Encuesta.objects.filter(empleado=empleado).count()
            
            # Actualizar empleado
            Empleado.objects.filter(id=empleado.id).update(
                promedio_calificacion=round(promedio_actual, 2),
                total_encuestas=total_encuestas
            )
            
            logger.info(
                f"✅ Ranking actualizado - Empleado: {empleado.nombre_completo} | "
                f"Promedio: {promedio_actual:.2f} | Total encuestas: {total_encuestas}"
            )
        
        # 2. VERIFICACIÓN DE UMBRAL (ALERTA INTELIGENTE)
        if encuesta.clasificacion == 'N':  # Solo si es Negativa
            config = EncuestaConfig.get_config()
            fecha_limite = timezone.now() - timedelta(days=config.dias_ventana_alerta)
            
            # Contar encuestas negativas en la ventana de tiempo
            encuestas_negativas = Encuesta.objects.filter(
                empleado=empleado,
                clasificacion='N',
                fecha_respuesta__gte=fecha_limite
            ).count()
            
            logger.info(
                f"📊 Verificación de umbral - Empleado: {empleado.nombre_completo} | "
                f"Negativas ({config.dias_ventana_alerta} días): {encuestas_negativas}/{config.umbral_notificacion_propietario}"
            )
            
            # Disparar alerta si se supera el umbral
            if encuestas_negativas >= config.umbral_notificacion_propietario:
                alerta_propietario_bajo_rendimiento.delay(empleado.id, encuestas_negativas)
                
                # Marcar encuesta como alertada
                Encuesta.objects.filter(id=encuesta_id).update(alerta_enviada=True)
        
        # Marcar como procesada
        Encuesta.objects.filter(id=encuesta_id).update(procesada=True)
        
        return {
            'success': True,
            'empleado': empleado.nombre_completo,
            'promedio': float(promedio_actual),
            'total_encuestas': total_encuestas
        }
        
    except Encuesta.DoesNotExist:
        logger.error(f"❌ Encuesta {encuesta_id} no existe")
        return {'success': False, 'error': 'Encuesta no encontrada'}
    except Exception as e:
        logger.error(f"❌ Error procesando encuesta {encuesta_id}: {str(e)}")
        return {'success': False, 'error': str(e)}


@shared_task
def alerta_propietario_bajo_rendimiento(empleado_id, cantidad_negativas):
    """
    Enviar alerta al propietario cuando un empleado excede el umbral de encuestas negativas
    
    Args:
        empleado_id: ID del empleado con bajo rendimiento
        cantidad_negativas: Cantidad de encuestas negativas detectadas
    """
    from apps.empleados.models import Empleado
    from apps.encuestas.models import EncuestaConfig, Encuesta
    from apps.users.models import User
    
    try:
        empleado = Empleado.objects.select_related('user').get(id=empleado_id)
        config = EncuestaConfig.get_config()
        
        # Obtener email del propietario
        if settings.DEBUG:
            # En desarrollo, usar email override
            destinatario = config.email_override_debug
            logger.info(f"🔧 DEBUG MODE: Email redirigido a {destinatario}")
        else:
            # En producción, enviar a propietarios/superusuarios
            propietarios = User.objects.filter(
                role__in=['propietario', 'superusuario'],
                is_active=True
            ).values_list('email', flat=True)
            destinatario = list(propietarios)
            
            if not destinatario:
                logger.warning("⚠️ No hay propietarios configurados para recibir alertas")
                return {'success': False, 'error': 'No hay destinatarios'}
        
        # Obtener últimas encuestas negativas para el contexto
        fecha_limite = timezone.now() - timedelta(days=config.dias_ventana_alerta)
        ultimas_negativas = Encuesta.objects.filter(
            empleado=empleado,
            clasificacion='N',
            fecha_respuesta__gte=fecha_limite
        ).order_by('-fecha_respuesta')[:5]
        
        # Construir mensaje personalizado
        asunto = f"⚠️ ALERTA: Bajo rendimiento - {empleado.nombre_completo}"
        
        mensaje_texto = f"""
╔══════════════════════════════════════════════════════════╗
║          ALERTA DE RENDIMIENTO - BEAUTIFUL STUDIO        ║
╚══════════════════════════════════════════════════════════╝

🚨 PROFESIONAL CON BAJO RENDIMIENTO DETECTADO

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 RESUMEN:
   • Profesional: {empleado.nombre_completo}
   • Email: {empleado.user.email}
   • Especialidad: {empleado.get_especialidades_display()}
   
📉 MÉTRICAS:
   • Encuestas negativas (últimos {config.dias_ventana_alerta} días): {cantidad_negativas}
   • Umbral configurado: {config.umbral_notificacion_propietario}
   • Promedio general: {empleado.promedio_calificacion}/10
   • Total de encuestas: {empleado.total_encuestas}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 ÚLTIMAS ENCUESTAS NEGATIVAS:
"""
        
        for i, enc in enumerate(ultimas_negativas, 1):
            mensaje_texto += f"\n   {i}. Puntaje: {enc.puntaje}/10 | Fecha: {enc.fecha_respuesta.strftime('%d/%m/%Y %H:%M')}"
            if enc.comentario:
                mensaje_texto += f"\n      💬 \"{enc.comentario[:100]}...\""
        
        mensaje_texto += f"""

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ ACCIONES RECOMENDADAS:
   1. Revisar el desempeño del profesional
   2. Programar reunión de retroalimentación
   3. Identificar áreas de mejora
   4. Considerar capacitación adicional

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📧 Este es un mensaje automático del sistema de monitoreo inteligente.
🔔 Alerta generada: {timezone.now().strftime('%d/%m/%Y %H:%M:%S')}

╚══════════════════════════════════════════════════════════╝
"""
        
        # Enviar email
        enviados = send_mail(
            subject=asunto,
            message=mensaje_texto,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[destinatario] if isinstance(destinatario, str) else destinatario,
            fail_silently=False,
        )
        
        logger.info(
            f"📧 Alerta enviada exitosamente - Empleado: {empleado.nombre_completo} | "
            f"Destinatario(s): {destinatario} | Emails enviados: {enviados}"
        )
        
        return {
            'success': True,
            'empleado': empleado.nombre_completo,
            'cantidad_negativas': cantidad_negativas,
            'emails_enviados': enviados
        }
        
    except Empleado.DoesNotExist:
        logger.error(f"❌ Empleado {empleado_id} no existe")
        return {'success': False, 'error': 'Empleado no encontrado'}
    except Exception as e:
        logger.error(f"❌ Error enviando alerta para empleado {empleado_id}: {str(e)}")
        return {'success': False, 'error': str(e)}


@shared_task
def enviar_encuesta_post_servicio(turno_id):
    """
    Enviar encuesta de satisfacción al cliente después de completar un servicio
    
    Args:
        turno_id: ID del turno completado
    """
    from apps.turnos.models import Turno
    from apps.encuestas.models import Encuesta, EncuestaConfig
    
    try:
        turno = Turno.objects.select_related('cliente__user', 'empleado__user', 'servicio').get(id=turno_id)
        
        # Verificar que el turno esté completado
        if turno.estado != 'completado':
            logger.warning(f"⚠️ Turno {turno_id} no está completado. Estado: {turno.estado}")
            return {'success': False, 'error': 'Turno no completado'}
        
        # Verificar si ya existe encuesta para este turno
        if hasattr(turno, 'encuesta'):
            logger.info(f"✅ Turno {turno_id} ya tiene encuesta asociada")
            return {'success': False, 'error': 'Encuesta ya existe'}
        
        # Obtener email del cliente
        config = EncuestaConfig.get_config()
        if settings.DEBUG:
            # En desarrollo, usar email override de Mailtrap
            destinatario = config.email_override_debug
            logger.info(f"🔧 DEBUG MODE: Email redirigido a {destinatario}")
        else:
            # En producción, enviar al email real del cliente
            destinatario = turno.cliente.user.email
        
        # Construir link de la encuesta (frontend)
        frontend_url = settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else 'http://localhost:3000'
        link_encuesta = f"{frontend_url}/encuesta/{turno_id}"
        
        # Construir email personalizado
        asunto = f"✨ ¿Cómo fue tu experiencia en Beautiful Studio?"
        
        mensaje_texto = f"""
╔══════════════════════════════════════════════════════════╗
║            BEAUTIFUL STUDIO - Encuesta de Satisfacción    ║
╚══════════════════════════════════════════════════════════╝

Hola {turno.cliente.nombre_completo},

¡Gracias por confiar en nosotros! 💖

Tu opinión es muy importante para nosotros. Nos encantaría saber cómo fue tu experiencia con:

📋 Servicio: {turno.servicio.nombre}
👤 Profesional: {turno.empleado.nombre_completo}
📅 Fecha: {turno.fecha_hora.strftime('%d/%m/%Y a las %H:%M')}
💰 Precio: ${turno.precio_final}

Por favor, tómate un minuto para responder nuestra encuesta:

🔗 {link_encuesta}

Tu feedback nos ayuda a mejorar y ofrecer el mejor servicio posible.

¡Esperamos verte pronto! ✨

---
Beautiful Studio
Belleza que transforma
"""
        
        mensaje_html = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
        .content {{ background: white; padding: 30px; border-radius: 0 0 10px 10px; }}
        .servicio-card {{ background: #f3f4f6; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }}
        .btn {{ display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }}
        .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 14px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✨ Beautiful Studio</h1>
            <p>Encuesta de Satisfacción</p>
        </div>
        <div class="content">
            <p>Hola <strong>{turno.cliente.nombre_completo}</strong>,</p>
            
            <p>¡Gracias por confiar en nosotros! 💖</p>
            
            <p>Tu opinión es muy importante. Nos encantaría saber cómo fue tu experiencia:</p>
            
            <div class="servicio-card">
                <p><strong>📋 Servicio:</strong> {turno.servicio.nombre}</p>
                <p><strong>👤 Profesional:</strong> {turno.empleado.nombre_completo}</p>
                <p><strong>📅 Fecha:</strong> {turno.fecha_hora.strftime('%d/%m/%Y a las %H:%M')}</p>
                <p><strong>💰 Precio:</strong> ${turno.precio_final}</p>
            </div>
            
            <p style="text-align: center;">
                <a href="{link_encuesta}" class="btn">Responder Encuesta</a>
            </p>
            
            <p>Tu feedback nos ayuda a mejorar y ofrecer el mejor servicio posible.</p>
            
            <p>¡Esperamos verte pronto! ✨</p>
        </div>
        <div class="footer">
            <p>Beautiful Studio - Belleza que transforma</p>
        </div>
    </div>
</body>
</html>
"""
        
        # Enviar email
        enviados = send_mail(
            subject=asunto,
            message=mensaje_texto,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[destinatario],
            fail_silently=False,
            html_message=mensaje_html,
        )
        
        logger.info(
            f"📧 Encuesta enviada exitosamente - Cliente: {turno.cliente.nombre_completo} | "
            f"Servicio: {turno.servicio.nombre} | Profesional: {turno.empleado.nombre_completo} | "
            f"Destinatario: {destinatario} | Emails enviados: {enviados}"
        )
        
        return {
            'success': True,
            'turno': turno_id,
            'cliente': turno.cliente.nombre_completo,
            'email_enviado': destinatario,
            'link_encuesta': link_encuesta
        }
        
    except Turno.DoesNotExist:
        logger.error(f"❌ Turno {turno_id} no existe")
        return {'success': False, 'error': 'Turno no encontrado'}
    except Exception as e:
        logger.error(f"❌ Error enviando encuesta para turno {turno_id}: {str(e)}")
        return {'success': False, 'error': str(e)}
