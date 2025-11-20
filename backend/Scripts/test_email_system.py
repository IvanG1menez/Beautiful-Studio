"""
Script para probar el envío de emails automáticos
Crea un turno de prueba y verifica que se envíen los emails correspondientes
"""

import os
import sys
import django

# Configurar Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.utils import timezone
from datetime import timedelta
from apps.turnos.models import Turno
from apps.clientes.models import Cliente
from apps.empleados.models import Empleado
from apps.servicios.models import Servicio
from apps.notificaciones.models import NotificacionConfig, Notificacion
from apps.notificaciones.services import EmailService


def verificar_configuracion_email():
    """Verifica que la configuración de email esté correcta"""
    from django.conf import settings
    
    print("\n" + "="*60)
    print("VERIFICACIÓN DE CONFIGURACIÓN DE EMAIL")
    print("="*60)
    
    print(f"\nEMAIL_BACKEND: {settings.EMAIL_BACKEND}")
    print(f"EMAIL_HOST: {settings.EMAIL_HOST}")
    print(f"EMAIL_PORT: {settings.EMAIL_PORT}")
    print(f"EMAIL_USE_TLS: {settings.EMAIL_USE_TLS}")
    print(f"EMAIL_HOST_USER: {settings.EMAIL_HOST_USER}")
    print(f"DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}")
    print(f"DEBUG: {settings.DEBUG}")
    
    return True


def crear_turno_prueba():
    """Crea un turno de prueba para activar los signals"""
    print("\n" + "="*60)
    print("CREANDO TURNO DE PRUEBA")
    print("="*60)
    
    # Obtener un empleado, cliente y servicio existente
    try:
        empleado = Empleado.objects.first()
        cliente = Cliente.objects.first()
        servicio = Servicio.objects.first()
        
        if not empleado or not cliente or not servicio:
            print("\n❌ Error: No hay datos suficientes en la base de datos")
            print("   Necesitas al menos 1 empleado, 1 cliente y 1 servicio")
            return None
        
        print(f"\n📋 Empleado: {empleado.user.get_full_name()} ({empleado.user.email})")
        print(f"📋 Cliente: {cliente.nombre_completo}")
        print(f"📋 Servicio: {servicio.nombre} (${servicio.precio})")
        
        # Verificar/crear configuración de notificaciones para el empleado
        config, created = NotificacionConfig.objects.get_or_create(
            user=empleado.user,
            defaults={
                'notificar_solicitud_turno': True,
                'email_solicitud_turno': True,
            }
        )
        
        if created:
            print(f"\n✅ Configuración de notificaciones creada para {empleado.user.email}")
        else:
            print(f"\n✅ Configuración de notificaciones ya existe para {empleado.user.email}")
        
        # Crear turno
        fecha_turno = timezone.now() + timedelta(days=2, hours=3)
        
        turno = Turno.objects.create(
            cliente=cliente,
            empleado=empleado,
            servicio=servicio,
            fecha_hora=fecha_turno,
            estado='pendiente',
            notas_cliente='Este es un turno de prueba para verificar el envío de emails'
        )
        
        print(f"\n✅ Turno creado exitosamente!")
        print(f"   ID: {turno.id}")
        print(f"   Fecha: {turno.fecha_hora.strftime('%d/%m/%Y %H:%M')}")
        print(f"   Estado: {turno.get_estado_display()}")
        
        return turno
        
    except Exception as e:
        print(f"\n❌ Error creando turno: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


def verificar_notificaciones(turno):
    """Verifica que se hayan creado las notificaciones"""
    print("\n" + "="*60)
    print("VERIFICANDO NOTIFICACIONES")
    print("="*60)
    
    # Notificaciones del profesional
    notif_profesional = Notificacion.objects.filter(
        usuario=turno.empleado.user,
        tipo='solicitud_turno'
    ).order_by('-created_at').first()
    
    if notif_profesional:
        print(f"\n✅ Notificación creada para profesional:")
        print(f"   Título: {notif_profesional.titulo}")
        print(f"   Mensaje: {notif_profesional.mensaje}")
    else:
        print(f"\n❌ No se encontró notificación para profesional")
    
    # Notificaciones del propietario
    from apps.users.models import User
    propietarios = User.objects.filter(role='propietario')
    
    if propietarios.exists():
        for propietario in propietarios:
            notif_prop = Notificacion.objects.filter(
                usuario=propietario,
                tipo='solicitud_turno'
            ).order_by('-created_at').first()
            
            if notif_prop:
                print(f"\n✅ Notificación creada para propietario ({propietario.email}):")
                print(f"   Título: {notif_prop.titulo}")
                print(f"   Mensaje: {notif_prop.mensaje}")
            else:
                print(f"\n⚠️  No se encontró notificación para propietario ({propietario.email})")
    else:
        print("\n⚠️  No hay propietarios registrados")


def probar_modificacion_turno(turno):
    """Prueba la modificación de un turno"""
    print("\n" + "="*60)
    print("PROBANDO MODIFICACIÓN DE TURNO")
    print("="*60)
    
    try:
        nueva_fecha = turno.fecha_hora + timedelta(days=1)
        turno.fecha_hora = nueva_fecha
        turno.save()
        
        print(f"\n✅ Turno modificado exitosamente!")
        print(f"   Nueva fecha: {turno.fecha_hora.strftime('%d/%m/%Y %H:%M')}")
        
    except Exception as e:
        print(f"\n❌ Error modificando turno: {str(e)}")


def probar_cancelacion_turno(turno):
    """Prueba la cancelación de un turno"""
    print("\n" + "="*60)
    print("PROBANDO CANCELACIÓN DE TURNO")
    print("="*60)
    
    try:
        turno.estado = 'cancelado'
        turno.save()
        
        print(f"\n✅ Turno cancelado exitosamente!")
        print(f"   Estado: {turno.get_estado_display()}")
        
    except Exception as e:
        print(f"\n❌ Error cancelando turno: {str(e)}")


def main():
    """Función principal"""
    print("\n" + "🎨"*30)
    print("  SCRIPT DE PRUEBA DE ENVÍO DE EMAILS")
    print("  Beautiful Studio - Sistema de Notificaciones")
    print("🎨"*30)
    
    # Verificar configuración
    if not verificar_configuracion_email():
        return
    
    # Crear turno de prueba
    turno = crear_turno_prueba()
    if not turno:
        return
    
    # Verificar notificaciones
    verificar_notificaciones(turno)
    
    # Preguntar si desea probar modificación
    print("\n" + "-"*60)
    respuesta = input("\n¿Deseas probar la modificación del turno? (s/n): ")
    if respuesta.lower() == 's':
        probar_modificacion_turno(turno)
        verificar_notificaciones(turno)
    
    # Preguntar si desea probar cancelación
    print("\n" + "-"*60)
    respuesta = input("\n¿Deseas probar la cancelación del turno? (s/n): ")
    if respuesta.lower() == 's':
        probar_cancelacion_turno(turno)
        verificar_notificaciones(turno)
    
    print("\n" + "="*60)
    print("PRUEBA COMPLETADA")
    print("="*60)
    print("\n📧 Si DEBUG=True, revisa la consola del servidor Django")
    print("📧 Si usas Mailtrap, revisa tu inbox en https://mailtrap.io")
    print("\n✨ ¡Revisa tu email para ver las notificaciones enviadas!")
    print()


if __name__ == '__main__':
    main()
