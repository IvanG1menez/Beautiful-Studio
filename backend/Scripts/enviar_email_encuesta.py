"""
Script simple para enviar email de encuesta a un turno específico

USO:
    python enviar_email_encuesta.py <turno_id>

EJEMPLO:
    python enviar_email_encuesta.py 99
"""

import os
import sys
import django
from pathlib import Path

# Configurar Django
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.core.mail import send_mail
from django.conf import settings
from apps.turnos.models import Turno


def enviar_email_encuesta(turno_id):
    """Enviar email de encuesta para un turno específico"""
    
    print(f"\n{'='*70}")
    print(f"📧 ENVIANDO EMAIL DE ENCUESTA - TURNO {turno_id}")
    print(f"{'='*70}\n")
    
    try:
        # Buscar el turno
        turno = Turno.objects.select_related(
            'cliente__user', 'empleado__user', 'servicio'
        ).get(id=turno_id)
        
        print(f"✅ Turno encontrado:")
        print(f"   - ID: {turno.id}")
        print(f"   - Cliente: {turno.cliente.nombre_completo} ({turno.cliente.user.email})")
        print(f"   - Profesional: {turno.empleado.nombre_completo}")
        print(f"   - Servicio: {turno.servicio.nombre}")
        print(f"   - Estado: {turno.estado}")
        print(f"   - Precio: ${turno.precio_final}")
        
        # Verificar estado
        if turno.estado != 'completado':
            print(f"\n⚠️  ADVERTENCIA: El turno NO está completado")
            print(f"    Estado actual: {turno.estado}")
            respuesta = input(f"\n¿Marcar como completado y continuar? (s/n): ")
            
            if respuesta.lower() != 's':
                print("❌ Operación cancelada")
                return
            
            # Marcar como completado
            from django.utils import timezone
            turno.estado = 'completado'
            turno.fecha_hora_completado = timezone.now()
            turno.save()
            print(f"✅ Turno marcado como completado")
        
        # Verificar si ya tiene encuesta
        if hasattr(turno, 'encuesta'):
            print(f"\n⚠️  Este turno ya tiene una encuesta respondida")
            respuesta = input(f"¿Enviar email de todas formas? (s/n): ")
            
            if respuesta.lower() != 's':
                print("❌ Operación cancelada")
                return
        
        # Preparar email
        destinatario = 'gimenezivanb@gmail.com'  # Mailtrap
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
        
        # Enviar email
        print(f"\n📧 Enviando email...")
        print(f"   Destinatario (Mailtrap): {destinatario}")
        print(f"   Email original: {turno.cliente.user.email}")
        print(f"   Link encuesta: {link_encuesta}")
        
        enviados = send_mail(
            subject=asunto,
            message=mensaje_texto,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[destinatario],
            fail_silently=False,
            html_message=mensaje_html,
        )
        
        print(f"\n✅ EMAIL ENVIADO EXITOSAMENTE!")
        print(f"   Emails enviados: {enviados}")
        print(f"\n📩 Revisa Mailtrap: https://mailtrap.io/inboxes")
        print(f"\n{'='*70}\n")
        
    except Turno.DoesNotExist:
        print(f"❌ ERROR: Turno {turno_id} no encontrado")
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("\n❌ Error: Debes proporcionar el ID del turno")
        print("\nUSO:")
        print("  python enviar_email_encuesta.py <turno_id>")
        print("\nEJEMPLO:")
        print("  python enviar_email_encuesta.py 99")
        print()
        sys.exit(1)
    
    try:
        turno_id = int(sys.argv[1])
        enviar_email_encuesta(turno_id)
    except ValueError:
        print(f"\n❌ Error: '{sys.argv[1]}' no es un número válido")
        sys.exit(1)
