"""
Script para simular la finalización de turnos y envío de encuestas

Este script:
1. Busca turnos confirmados de los usuarios especificados
2. Los marca como completados
3. Dispara el envío de emails con encuestas a gimenezivanb@gmail.com (Mailtrap)

Usuarios objetivo:
- Cliente: ricardo.prieto98@hotmail.com
- Profesional: pro.adriana.cruz.pro636292@gmail.com
"""

import os
import sys
import django
from pathlib import Path
from datetime import datetime
import time  # Para el delay entre emails

# Configurar el path de Django
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from apps.turnos.models import Turno
from apps.clientes.models import Cliente
from apps.empleados.models import Empleado


def enviar_encuesta_manual(turno):
    """
    Enviar encuesta sin usar Celery (para testing)
    """
    # Verificar que el turno esté completado
    if turno.estado != 'completado':
        return {'success': False, 'error': 'Turno no completado'}
    
    # Obtener email del cliente
    destinatario = 'gimenezivanb@gmail.com'  # Mailtrap override
    
    # Construir link de la encuesta
    frontend_url = 'http://localhost:3000'
    link_encuesta = f"{frontend_url}/encuesta/{turno.id}"
    
    # Email HTML personalizado
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
    try:
        enviados = send_mail(
            subject=asunto,
            message=mensaje_texto,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[destinatario],
            fail_silently=False,
            html_message=mensaje_html,
        )
        
        return {
            'success': True,
            'turno': turno.id,
            'cliente': turno.cliente.nombre_completo,
            'email_enviado': destinatario,
            'link_encuesta': link_encuesta,
            'emails_enviados': enviados
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def main():
    print("\n" + "="*70)
    print("🧪 SIMULACIÓN DE FINALIZACIÓN DE TURNOS")
    print("="*70 + "\n")
    
    # === PASO 1: Buscar el cliente ===
    print("📋 PASO 1: Buscando cliente ricardo.prieto98@hotmail.com...")
    try:
        cliente = Cliente.objects.select_related('user').get(
            user__email='ricardo.prieto98@hotmail.com'
        )
        print(f"   ✅ Cliente encontrado: {cliente.nombre_completo} (ID: {cliente.id})")
    except Cliente.DoesNotExist:
        print("   ❌ ERROR: Cliente no encontrado")
        return
    
    # === PASO 2: Buscar la profesional ===
    print("\n📋 PASO 2: Buscando profesional pro.adriana.cruz.pro636292@gmail.com...")
    try:
        profesional = Empleado.objects.select_related('user').get(
            user__email='pro.adriana.cruz.pro636292@gmail.com'
        )
        print(f"   ✅ Profesional encontrada: {profesional.nombre_completo} (ID: {profesional.id})")
        print(f"   📊 Promedio actual: {profesional.promedio_calificacion}/10")
        print(f"   📈 Total encuestas: {profesional.total_encuestas}")
    except Empleado.DoesNotExist:
        print("   ❌ ERROR: Profesional no encontrada")
        return
    
    # === PASO 3: Buscar turnos del cliente ===
    print(f"\n📋 PASO 3: Buscando turnos de {cliente.nombre_completo}...")
    turnos_cliente = Turno.objects.filter(
        cliente=cliente,
        estado__in=['confirmado', 'pendiente']
    ).select_related('servicio', 'empleado__user').order_by('fecha_hora')
    
    print(f"   ✅ Encontrados {turnos_cliente.count()} turnos en estado confirmado/pendiente")
    
    if turnos_cliente.count() == 0:
        print("   ⚠️ No hay turnos para finalizar")
        return
    
    # Mostrar turnos disponibles
    print("\n   Turnos disponibles:")
    for idx, turno in enumerate(turnos_cliente[:5], 1):  # Máximo 5
        print(f"   {idx}. {turno.servicio.nombre} con {turno.empleado.nombre_completo}")
        print(f"      Fecha: {turno.fecha_hora.strftime('%d/%m/%Y %H:%M')} | Precio: ${turno.precio_final}")
    
    # === PASO 4: Seleccionar turno a finalizar ===
    print(f"\n📋 PASO 4: Finalizando el primer turno...")
    turno_a_finalizar = turnos_cliente.first()
    
    print(f"\n   📝 TURNO SELECCIONADO:")
    print(f"   - ID: {turno_a_finalizar.id}")
    print(f"   - Cliente: {turno_a_finalizar.cliente.nombre_completo}")
    print(f"   - Servicio: {turno_a_finalizar.servicio.nombre}")
    print(f"   - Profesional: {turno_a_finalizar.empleado.nombre_completo}")
    print(f"   - Fecha original: {turno_a_finalizar.fecha_hora.strftime('%d/%m/%Y %H:%M')}")
    print(f"   - Precio: ${turno_a_finalizar.precio_final}")
    print(f"   - Estado actual: {turno_a_finalizar.estado}")
    
    # === PASO 5: Marcar como completado ===
    print(f"\n📋 PASO 5: Marcando turno como completado...")
    turno_a_finalizar.estado = 'completado'
    turno_a_finalizar.fecha_hora_completado = timezone.now()
    turno_a_finalizar.save()
    print(f"   ✅ Turno marcado como completado a las {turno_a_finalizar.fecha_hora_completado.strftime('%d/%m/%Y %H:%M:%S')}")
    
    # === PASO 6: Enviar encuesta ===
    print(f"\n📋 PASO 6: Enviando encuesta por email...")
    print(f"   📧 Destinatario (Mailtrap): gimenezivanb@gmail.com")
    print(f"   📧 Cliente original: {cliente.user.email}")
    
    try:
        # Llamar a la función de envío de email directamente
        resultado = enviar_encuesta_manual(turno_a_finalizar)
        
        if resultado.get('success'):
            print(f"\n   ✅ EMAIL ENVIADO EXITOSAMENTE!")
            print(f"   📧 Email: {resultado.get('email_enviado')}")
            print(f"   🔗 Link encuesta: {resultado.get('link_encuesta')}")
            print(f"\n   📩 Revisa Mailtrap en: https://mailtrap.io/inboxes")
            print(f"   👉 El email debería aparecer en la bandeja de gimenezivanb@gmail.com")
        else:
            print(f"\n   ❌ ERROR al enviar email: {resultado.get('error')}")
    
    except Exception as e:
        print(f"\n   ❌ EXCEPCIÓN al enviar email: {str(e)}")
        import traceback
        traceback.print_exc()
    
    # === PASO 7: Buscar turno con la profesional específica ===
    print(f"\n\n" + "="*70)
    print("📋 PASO 7: Buscando turno CON LA PROFESIONAL Adriana Cruz...")
    print("="*70 + "\n")
    
    turnos_con_adriana = Turno.objects.filter(
        empleado=profesional,
        estado__in=['confirmado', 'pendiente']
    ).select_related('cliente__user', 'servicio').order_by('fecha_hora')
    
    print(f"   ✅ Encontrados {turnos_con_adriana.count()} turnos con {profesional.nombre_completo}")
    
    if turnos_con_adriana.count() == 0:
        print("   ⚠️ No hay turnos con esta profesional para finalizar")
        print("\n" + "="*70)
        print("✅ SIMULACIÓN COMPLETADA (1 turno procesado)")
        print("="*70 + "\n")
        return
    
    # Mostrar turnos con Adriana
    print("\n   Turnos disponibles:")
    for idx, turno in enumerate(turnos_con_adriana[:5], 1):
        print(f"   {idx}. {turno.servicio.nombre} para {turno.cliente.nombre_completo}")
        print(f"      Fecha: {turno.fecha_hora.strftime('%d/%m/%Y %H:%M')} | Precio: ${turno.precio_final}")
    
    # Finalizar turno con Adriana
    turno_adriana = turnos_con_adriana.first()
    
    print(f"\n   📝 TURNO SELECCIONADO (ADRIANA):")
    print(f"   - ID: {turno_adriana.id}")
    print(f"   - Cliente: {turno_adriana.cliente.nombre_completo} ({turno_adriana.cliente.user.email})")
    print(f"   - Servicio: {turno_adriana.servicio.nombre}")
    print(f"   - Profesional: {turno_adriana.empleado.nombre_completo}")
    print(f"   - Fecha original: {turno_adriana.fecha_hora.strftime('%d/%m/%Y %H:%M')}")
    print(f"   - Precio: ${turno_adriana.precio_final}")
    
    # Marcar como completado
    print(f"\n📋 Marcando turno como completado...")
    turno_adriana.estado = 'completado'
    turno_adriana.fecha_hora_completado = timezone.now()
    turno_adriana.save()
    print(f"   ✅ Turno marcado como completado")
    
    # Enviar encuesta
    print(f"\n📋 Enviando encuesta por email...")
    print(f"   📧 Destinatario (Mailtrap): gimenezivanb@gmail.com")
    print(f"   📧 Cliente original: {turno_adriana.cliente.user.email}")
    print(f"   ⏳ Esperando 3 segundos para evitar rate limit...")
    
    time.sleep(3)  # Delay de 3 segundos para evitar rate limit de Mailtrap
    
    try:
        resultado = enviar_encuesta_manual(turno_adriana)
        
        if resultado.get('success'):
            print(f"\n   ✅ EMAIL ENVIADO EXITOSAMENTE!")
            print(f"   📧 Email: {resultado.get('email_enviado')}")
            print(f"   🔗 Link encuesta: {resultado.get('link_encuesta')}")
        else:
            print(f"\n   ❌ ERROR al enviar email: {resultado.get('error')}")
    
    except Exception as e:
        print(f"\n   ❌ EXCEPCIÓN al enviar email: {str(e)}")
        import traceback
        traceback.print_exc()
    
    # === RESUMEN FINAL ===
    print("\n" + "="*70)
    print("✅ SIMULACIÓN COMPLETADA")
    print("="*70)
    print(f"\n📊 RESUMEN:")
    print(f"   • 2 turnos finalizados y marcados como 'completado'")
    print(f"   • 2 emails enviados a gimenezivanb@gmail.com (Mailtrap)")
    print(f"   • Cliente original: {cliente.user.email}")
    print(f"   • Profesional evaluada: {profesional.nombre_completo}")
    print(f"\n📧 Revisa los emails en:")
    print(f"   https://mailtrap.io/inboxes")
    print(f"\n💡 Los clientes recibirán un link para calificar el servicio")
    print(f"   Las respuestas actualizarán el ranking de {profesional.nombre_completo}")
    print("="*70 + "\n")


if __name__ == '__main__':
    main()
