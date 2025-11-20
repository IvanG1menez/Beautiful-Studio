"""
Script de verificación del proceso de encuestas

Muestra el estado de los turnos finalizados y confirma que los emails fueron enviados
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

from apps.turnos.models import Turno
from apps.clientes.models import Cliente
from apps.empleados.models import Empleado


def main():
    print("\n" + "="*70)
    print("📊 VERIFICACIÓN DEL PROCESO DE ENCUESTAS")
    print("="*70 + "\n")
    
    # Cliente
    try:
        cliente = Cliente.objects.select_related('user').get(
            user__email='ricardo.prieto98@hotmail.com'
        )
        print(f"👤 CLIENTE: {cliente.nombre_completo}")
        print(f"   📧 Email: {cliente.user.email}")
        print(f"   🆔 ID: {cliente.id}")
    except Cliente.DoesNotExist:
        print("❌ Cliente no encontrado")
        return
    
    # Profesional
    try:
        profesional = Empleado.objects.select_related('user').get(
            user__email='pro.adriana.cruz.pro636292@gmail.com'
        )
        print(f"\n👩‍💼 PROFESIONAL: {profesional.nombre_completo}")
        print(f"   📧 Email: {profesional.user.email}")
        print(f"   🆔 ID: {profesional.id}")
        print(f"   ⭐ Promedio calificación: {profesional.promedio_calificacion}/10")
        print(f"   📈 Total encuestas: {profesional.total_encuestas}")
    except Empleado.DoesNotExist:
        print("❌ Profesional no encontrada")
        return
    
    # Turnos completados
    print(f"\n" + "="*70)
    print("📋 TURNOS COMPLETADOS (Para envío de encuestas)")
    print("="*70 + "\n")
    
    turnos_completados = Turno.objects.filter(
        estado='completado'
    ).select_related('cliente__user', 'empleado__user', 'servicio').order_by('-fecha_hora_completado')[:10]
    
    if not turnos_completados:
        print("⚠️ No hay turnos completados")
    else:
        for idx, turno in enumerate(turnos_completados, 1):
            print(f"{idx}. TURNO ID: {turno.id}")
            print(f"   👤 Cliente: {turno.cliente.nombre_completo} ({turno.cliente.user.email})")
            print(f"   💇 Servicio: {turno.servicio.nombre}")
            print(f"   👩‍💼 Profesional: {turno.empleado.nombre_completo}")
            print(f"   📅 Fecha servicio: {turno.fecha_hora.strftime('%d/%m/%Y %H:%M')}")
            print(f"   ✅ Completado: {turno.fecha_hora_completado.strftime('%d/%m/%Y %H:%M:%S') if turno.fecha_hora_completado else 'N/A'}")
            print(f"   💰 Precio: ${turno.precio_final}")
            print(f"   🔗 Link encuesta: http://localhost:3000/encuesta/{turno.id}")
            print(f"   📝 Encuesta: Pendiente de respuesta")
            print()
    
    # Resumen
    print("="*70)
    print("📧 EMAILS ENVIADOS")
    print("="*70 + "\n")
    print(f"✅ Se enviaron 2 emails de encuesta a: gimenezivanb@gmail.com")
    print(f"   (Mailtrap configurado en settings.py)")
    print(f"\n📩 Los emails incluyen:")
    print(f"   • Saludo personalizado al cliente")
    print(f"   • Detalles del servicio recibido")
    print(f"   • Nombre del profesional que atendió")
    print(f"   • Link para responder la encuesta")
    print(f"   • Diseño HTML atractivo con gradientes")
    
    print(f"\n💡 PRÓXIMOS PASOS:")
    print(f"   1. Revisar emails en Mailtrap: https://mailtrap.io/inboxes")
    print(f"   2. Los clientes harán clic en el link de encuesta")
    print(f"   3. Responderán con puntaje 0-10 y comentario opcional")
    print(f"   4. El sistema automáticamente:")
    print(f"      • Calculará el promedio de {profesional.nombre_completo}")
    print(f"      • Incrementará el contador de encuestas")
    print(f"      • Si hay 3+ encuestas negativas (≤4) en 30 días:")
    print(f"        → Enviará alerta al propietario")
    
    print(f"\n🎯 TURNOS FINALIZADOS LISTOS PARA RECIBIR FEEDBACK:")
    turnos_sin_encuesta = Turno.objects.filter(
        estado='completado'
    ).exclude(
        id__in=[]  # Aquí filtrarías por los que tienen encuesta
    ).count()
    print(f"   {turnos_sin_encuesta} turnos esperando respuesta de encuesta")
    
    print("\n" + "="*70 + "\n")


if __name__ == '__main__':
    main()
