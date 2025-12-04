"""
Signals para la app de encuestas
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string

from apps.turnos.models import Turno


@receiver(post_save, sender=Turno)
def enviar_email_encuesta_automatico(sender, instance, created, **kwargs):
    """
    Signal que envía email de encuesta automáticamente cuando un turno se marca como completado
    """
    # Solo procesar si el turno cambió a estado 'completado'
    if not created and instance.estado == 'completado':
        # Verificar que no tenga encuesta ya respondida
        if hasattr(instance, 'encuesta'):
            return
        
        # Obtener email del cliente
        cliente_email = instance.cliente.user.email
        
        # En desarrollo, enviar a Mailtrap usando el email override
        if settings.DEBUG:
            email_destino = 'gimenezivanb@gmail.com'
        else:
            email_destino = cliente_email
        
        # Generar link de encuesta
        link_encuesta = f'http://localhost:3000/encuesta/{instance.id}'
        
        # Preparar contexto para el email
        contexto = {
            'cliente_nombre': instance.cliente.nombre_completo,
            'servicio': instance.servicio.nombre,
            'profesional': instance.empleado.nombre_completo if instance.empleado else 'Profesional',
            'fecha': instance.fecha_hora.strftime('%d/%m/%Y'),
            'hora': instance.fecha_hora.strftime('%H:%M'),
            'link_encuesta': link_encuesta,
        }
        
        # Email en HTML
        mensaje_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                .button {{ display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }}
                .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
                .details {{ background: white; padding: 15px; border-radius: 5px; margin: 20px 0; }}
                .emoji {{ font-size: 48px; margin: 10px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="emoji">✨</div>
                    <h1>¡Gracias por tu visita!</h1>
                </div>
                <div class="content">
                    <p>Hola <strong>{contexto['cliente_nombre']}</strong>,</p>
                    
                    <p>Esperamos que hayas disfrutado de tu experiencia en Beautiful Studio.</p>
                    
                    <div class="details">
                        <p><strong>📋 Detalles de tu servicio:</strong></p>
                        <ul style="list-style: none; padding-left: 0;">
                            <li>✂️ Servicio: {contexto['servicio']}</li>
                            <li>👤 Profesional: {contexto['profesional']}</li>
                            <li>📅 Fecha: {contexto['fecha']}</li>
                            <li>🕐 Hora: {contexto['hora']}</li>
                        </ul>
                    </div>
                    
                    <p>Nos encantaría conocer tu opinión. Por favor, tómate un momento para completar esta breve encuesta de satisfacción:</p>
                    
                    <div style="text-align: center;">
                        <a href="{contexto['link_encuesta']}" class="button">
                            📝 Completar Encuesta
                        </a>
                    </div>
                    
                    <p style="margin-top: 30px; font-size: 14px; color: #666;">
                        La encuesta solo te tomará 2 minutos y nos ayudará a mejorar nuestros servicios.
                    </p>
                </div>
                <div class="footer">
                    <p>Beautiful Studio - Tu salón de confianza</p>
                    <p style="font-size: 10px; margin-top: 10px;">
                        Email original del cliente: {cliente_email}<br>
                        (Enviado a Mailtrap en modo desarrollo)
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Enviar email
        try:
            enviados = send_mail(
                subject=f'¡Tu opinión nos importa! - Beautiful Studio',
                message=f'Hola {contexto["cliente_nombre"]}, completa nuestra encuesta: {link_encuesta}',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email_destino],
                html_message=mensaje_html,
                fail_silently=False,
            )
            
            print(f'✅ Email de encuesta enviado automáticamente para turno #{instance.id}')
            print(f'   Destinatario (Mailtrap): {email_destino}')
            print(f'   Email original: {cliente_email}')
            
        except Exception as e:
            print(f'❌ Error al enviar email de encuesta: {str(e)}')
