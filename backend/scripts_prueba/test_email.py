"""
Script para probar el envío de emails

Uso:
    python test_email.py
"""

import os
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.turnos.send_email import enviar_email_prueba

# Email de prueba (reemplazar con tu email)
EMAIL_DESTINATARIO = "gimenezivanb@gmail.com"

if __name__ == "__main__":
    print("=" * 50)
    print("TEST DE ENVÍO DE EMAILS - Beautiful Studio")
    print("=" * 50)
    print()
    print(f"Enviando email de prueba a: {EMAIL_DESTINATARIO}")
    print()
    
    resultado = enviar_email_prueba(EMAIL_DESTINATARIO)
    
    print()
    if resultado:
        print("✓ Email enviado exitosamente!")
        print()
        print("Revisa tu bandeja de entrada (o spam) en Mailtrap:")
        print("https://mailtrap.io/inboxes")
    else:
        print("✗ Error al enviar el email")
        print()
        print("Verifica tu configuración en settings.py:")
        print("  - EMAIL_HOST")
        print("  - EMAIL_HOST_USER")
        print("  - EMAIL_HOST_PASSWORD")
        print("  - EMAIL_PORT")
    
    print()
    print("=" * 50)
