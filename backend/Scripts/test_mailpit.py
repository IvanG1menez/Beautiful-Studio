"""
Script de prueba para verificar la configuración de Mailpit.
Envía un correo electrónico de prueba para confirmar que el sistema de emails funciona correctamente.
"""

import os
import sys
import django
from pathlib import Path

# Configurar Django
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.core.mail import send_mail
from django.conf import settings


def test_email_configuration():
    """
    Envía un correo de prueba y muestra la configuración actual de email.
    """
    print("=" * 70)
    print("PRUEBA DE CONFIGURACIÓN DE MAILPIT")
    print("=" * 70)

    # Mostrar configuración actual
    print("\n📧 Configuración de Email:")
    print(f"   Backend: {settings.EMAIL_BACKEND}")
    print(f"   Host: {settings.EMAIL_HOST}")
    print(f"   Port: {settings.EMAIL_PORT}")
    print(f"   Use TLS: {settings.EMAIL_USE_TLS}")
    print(f"   Use SSL: {settings.EMAIL_USE_SSL}")
    print(f"   From: {settings.DEFAULT_FROM_EMAIL}")

    # Preparar el correo de prueba
    subject = "✅ Prueba de Mailpit - Beautiful Studio"
    message = """
    ¡Hola!
    
    Este es un correo de prueba para verificar que la configuración de Mailpit está funcionando correctamente.
    
    Si estás viendo este mensaje en la interfaz web de Mailpit (http://localhost:8025), 
    significa que el sistema de envío de correos está configurado correctamente.
    
    Detalles técnicos:
    - Servidor SMTP: Mailpit
    - Puerto: 1025
    - Backend de Django: SMTP
    
    ---
    Beautiful Studio - Sistema de Gestión
    """

    from_email = settings.DEFAULT_FROM_EMAIL
    recipient_list = ["test@beautifulstudio.com"]

    print("\n📨 Enviando correo de prueba...")
    print(f"   Para: {recipient_list[0]}")
    print(f"   Asunto: {subject}")

    try:
        # Enviar el correo
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=recipient_list,
            fail_silently=False,
        )

        print("\n✅ ¡Correo enviado exitosamente!")
        print("\n🌐 Accede a Mailpit para ver el correo:")
        print("   URL: http://localhost:8025")
        print("\n" + "=" * 70)

        return True

    except Exception as e:
        print(f"\n❌ Error al enviar el correo: {str(e)}")
        print("\n🔍 Verifica que:")
        print("   1. Docker está corriendo (docker ps)")
        print("   2. El contenedor de Mailpit está activo")
        print("   3. El puerto 1025 está disponible")
        print("   4. Las variables de entorno en .env son correctas")
        print("\n" + "=" * 70)

        return False


if __name__ == "__main__":
    success = test_email_configuration()
    sys.exit(0 if success else 1)
