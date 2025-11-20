"""
Script simplificado para enviar el segundo email de encuesta

Simplemente busca el turno que falló y reintenta el envío con delay
"""

import os
import sys
import django
from pathlib import Path
import time

# Configurar Django
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.core.mail import send_mail
from django.conf import settings
from apps.turnos.models import Turno


def enviar_encuesta_manual(turno):
    """Enviar encuesta sin usar Celery"""
    destinatario = 'gimenezivanb@gmail.com'
    frontend_url = 'http://localhost:3000'
    link_encuesta = f"{frontend_url}/encuesta/{turno.id}"
    
    asunto = f"✨ ¿Cómo fue tu experiencia en Beautiful Studio?"
    
    mensaje_texto = f"""
╔══════════════════════════════════════════════════════════╗
║            BEAUTIFUL STUDIO - Encuesta de Satisfacción    ║
╚══════════════════════════════════════════════════════════╝

Hola {turno.cliente.nombre_completo},

¡Gracias por confiar en nosotros! 💖

Tu opinión es muy importante. Nos encantaría saber cómo fue tu experiencia con:

📋 Servicio: {turno.servicio.nombre}
👤 Profesional: {turno.empleado.nombre_completo}
📅 Fecha: {turno.fecha_hora.strftime('%d/%m/%Y a las %H:%M')}
💰 Precio: ${turno.precio_final}

Por favor, tómate un minuto para responder nuestra encuesta:
🔗 {link_encuesta}

¡Esperamos verte pronto! ✨
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
            <div class="servicio-card">
                <p><strong>📋 Servicio:</strong> {turno.servicio.nombre}</p>
                <p><strong>👤 Profesional:</strong> {turno.empleado.nombre_completo}</p>
                <p><strong>📅 Fecha:</strong> {turno.fecha_hora.strftime('%d/%m/%Y a las %H:%M')}</p>
                <p><strong>💰 Precio:</strong> ${turno.precio_final}</p>
            </div>
            <p style="text-align: center;">
                <a href="{link_encuesta}" class="btn">Responder Encuesta</a>
            </p>
            <p>¡Esperamos verte pronto! ✨</p>
        </div>
    </div>
</body>
</html>
"""
    
    enviados = send_mail(
        subject=asunto,
        message=mensaje_texto,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[destinatario],
        fail_silently=False,
        html_message=mensaje_html,
    )
    
    return {'success': True, 'emails_enviados': enviados, 'link': link_encuesta}


def main():
    print("\n" + "="*70)
    print("📧 ENVÍO DEL SEGUNDO EMAIL DE ENCUESTA")
    print("="*70 + "\n")
    
    # Buscar el turno ID 99 que falló anteriormente
    try:
        turno = Turno.objects.select_related(
            'cliente__user', 'empleado__user', 'servicio'
        ).get(id=99)
        
        print(f"✅ Turno encontrado:")
        print(f"   - ID: {turno.id}")
        print(f"   - Cliente: {turno.cliente.nombre_completo} ({turno.cliente.user.email})")
        print(f"   - Servicio: {turno.servicio.nombre}")
        print(f"   - Profesional: {turno.empleado.nombre_completo}")
        print(f"   - Estado: {turno.estado}")
        
        print(f"\n⏳ Esperando 3 segundos para evitar rate limit...")
        time.sleep(3)
        
        print(f"\n📧 Enviando email a gimenezivanb@gmail.com (Mailtrap)...")
        resultado = enviar_encuesta_manual(turno)
        
        if resultado['success']:
            print(f"\n✅ EMAIL ENVIADO EXITOSAMENTE!")
            print(f"   📧 Emails enviados: {resultado['emails_enviados']}")
            print(f"   🔗 Link: {resultado['link']}")
            print(f"\n📩 Revisa Mailtrap: https://mailtrap.io/inboxes")
        else:
            print(f"\n❌ Error al enviar")
            
    except Turno.DoesNotExist:
        print("❌ Turno ID 99 no encontrado")
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "="*70 + "\n")


if __name__ == '__main__':
    main()
