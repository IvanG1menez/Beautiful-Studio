from django.core.mail import send_mail, EmailMultiAlternatives
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags


def enviar_email_confirmacion_turno(turno):
    """
    Envía un email de confirmación cuando se crea un turno
    
    Args:
        turno: Instancia del modelo Turno
    """
    subject = f'Confirmación de Turno - {turno.servicio.nombre}'
    
    # Email del cliente
    recipient_list = [turno.cliente.email]
    
    # Contenido del email en HTML
    html_message = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #5EADDE;">¡Turno Confirmado!</h2>
                
                <p>Hola <strong>{turno.cliente.get_full_name()}</strong>,</p>
                
                <p>Tu turno ha sido confirmado exitosamente.</p>
                
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #5EADDE;">Detalles del Turno:</h3>
                    <p><strong>Servicio:</strong> {turno.servicio.nombre}</p>
                    <p><strong>Profesional:</strong> {turno.empleado.get_full_name()}</p>
                    <p><strong>Fecha:</strong> {turno.fecha.strftime('%d/%m/%Y')}</p>
                    <p><strong>Hora:</strong> {turno.hora_inicio.strftime('%H:%M')} - {turno.hora_fin.strftime('%H:%M')}</p>
                    <p><strong>Duración:</strong> {turno.servicio.duracion_minutos} minutos</p>
                    <p><strong>Precio:</strong> ${turno.servicio.precio}</p>
                </div>
                
                <p style="color: #666; font-size: 14px;">
                    <strong>Nota:</strong> Por favor, llega 5 minutos antes de tu turno.
                </p>
                
                <p>¡Esperamos verte pronto!</p>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                
                <p style="color: #999; font-size: 12px;">
                    Beautiful Studio - Sistema de Gestión de Salón<br>
                    Este es un email automático, por favor no responder.
                </p>
            </div>
        </body>
    </html>
    """
    
    # Versión en texto plano
    plain_message = strip_tags(html_message)
    
    # Crear email con HTML
    email = EmailMultiAlternatives(
        subject=subject,
        body=plain_message,
        from_email=f'Beautiful Studio <noreply@beautifulstudio.com>',
        to=recipient_list
    )
    email.attach_alternative(html_message, "text/html")
    
    # Enviar email
    try:
        email.send()
        return True
    except Exception as e:
        print(f"Error al enviar email: {e}")
        return False


def enviar_email_cancelacion_turno(turno):
    """
    Envía un email cuando se cancela un turno
    
    Args:
        turno: Instancia del modelo Turno
    """
    subject = f'Turno Cancelado - {turno.servicio.nombre}'
    
    recipient_list = [turno.cliente.email]
    
    html_message = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #e74c3c;">Turno Cancelado</h2>
                
                <p>Hola <strong>{turno.cliente.get_full_name()}</strong>,</p>
                
                <p>Tu turno ha sido cancelado.</p>
                
                <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
                    <h3 style="margin-top: 0; color: #856404;">Detalles del Turno Cancelado:</h3>
                    <p><strong>Servicio:</strong> {turno.servicio.nombre}</p>
                    <p><strong>Profesional:</strong> {turno.empleado.get_full_name()}</p>
                    <p><strong>Fecha:</strong> {turno.fecha.strftime('%d/%m/%Y')}</p>
                    <p><strong>Hora:</strong> {turno.hora_inicio.strftime('%H:%M')}</p>
                </div>
                
                <p>Si tienes alguna consulta, no dudes en contactarnos.</p>
                
                <p>¡Esperamos verte pronto!</p>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                
                <p style="color: #999; font-size: 12px;">
                    Beautiful Studio - Sistema de Gestión de Salón<br>
                    Este es un email automático, por favor no responder.
                </p>
            </div>
        </body>
    </html>
    """
    
    plain_message = strip_tags(html_message)
    
    email = EmailMultiAlternatives(
        subject=subject,
        body=plain_message,
        from_email=f'Beautiful Studio <noreply@beautifulstudio.com>',
        to=recipient_list
    )
    email.attach_alternative(html_message, "text/html")
    
    try:
        email.send()
        return True
    except Exception as e:
        print(f"Error al enviar email: {e}")
        return False


def enviar_email_recordatorio_turno(turno):
    """
    Envía un email de recordatorio 24 horas antes del turno
    
    Args:
        turno: Instancia del modelo Turno
    """
    subject = f'Recordatorio: Turno Mañana - {turno.servicio.nombre}'
    
    recipient_list = [turno.cliente.email]
    
    html_message = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #5EADDE;">🔔 Recordatorio de Turno</h2>
                
                <p>Hola <strong>{turno.cliente.get_full_name()}</strong>,</p>
                
                <p>Te recordamos que tienes un turno programado para mañana.</p>
                
                <div style="background-color: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #5EADDE;">
                    <h3 style="margin-top: 0; color: #5EADDE;">Detalles del Turno:</h3>
                    <p><strong>Servicio:</strong> {turno.servicio.nombre}</p>
                    <p><strong>Profesional:</strong> {turno.empleado.get_full_name()}</p>
                    <p><strong>Fecha:</strong> {turno.fecha.strftime('%d/%m/%Y')}</p>
                    <p><strong>Hora:</strong> {turno.hora_inicio.strftime('%H:%M')} - {turno.hora_fin.strftime('%H:%M')}</p>
                </div>
                
                <p style="background-color: #fff3cd; padding: 10px; border-radius: 5px;">
                    <strong>💡 Importante:</strong> Si necesitas cancelar o reprogramar, 
                    hazlo con al menos 2 horas de anticipación.
                </p>
                
                <p>¡Te esperamos!</p>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                
                <p style="color: #999; font-size: 12px;">
                    Beautiful Studio - Sistema de Gestión de Salón<br>
                    Este es un email automático, por favor no responder.
                </p>
            </div>
        </body>
    </html>
    """
    
    plain_message = strip_tags(html_message)
    
    email = EmailMultiAlternatives(
        subject=subject,
        body=plain_message,
        from_email=f'Beautiful Studio <noreply@beautifulstudio.com>',
        to=recipient_list
    )
    email.attach_alternative(html_message, "text/html")
    
    try:
        email.send()
        return True
    except Exception as e:
        print(f"Error al enviar email: {e}")
        return False


# Función de prueba simple
def enviar_email_prueba(destinatario):
    """
    Envía un email de prueba
    
    Args:
        destinatario: Email del destinatario
    """
    subject = "Email de Prueba - Beautiful Studio"
    message = "¡Felicidades! El sistema de envío de emails está funcionando correctamente."
    from_email = "noreply@beautifulstudio.com"
    recipient_list = [destinatario]
    
    try:
        send_mail(subject, message, from_email, recipient_list)
        print(f"✓ Email de prueba enviado exitosamente a {destinatario}")
        return True
    except Exception as e:
        print(f"✗ Error al enviar email: {e}")
        return False