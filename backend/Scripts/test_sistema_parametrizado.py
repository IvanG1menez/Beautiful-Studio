"""
Script para probar el sistema parametrizado de encuestas
"""

import os
import sys
import django

# Configurar Django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.encuestas.models import EncuestaPregunta, Encuesta, RespuestaCliente, EncuestaConfig
from apps.empleados.models import Empleado
from apps.turnos.models import Turno
from django.db import transaction


def crear_preguntas_ejemplo():
    """Crear preguntas de ejemplo para el sistema"""
    
    print("\n" + "="*70)
    print("📝 CREANDO PREGUNTAS DE EJEMPLO")
    print("="*70 + "\n")
    
    preguntas = [
        {
            'texto': '¿Qué tan satisfecho estás con la calidad del servicio?',
            'categoria': 'Servicio',
            'orden': 1,
        },
        {
            'texto': '¿Cómo calificarías el profesionalismo del especialista?',
            'categoria': 'Profesional',
            'orden': 2,
        },
        {
            'texto': '¿El servicio comenzó a tiempo?',
            'categoria': 'Puntualidad',
            'orden': 3,
        },
        {
            'texto': '¿Cómo calificarías la limpieza e higiene del lugar?',
            'categoria': 'Instalaciones',
            'orden': 4,
        },
        {
            'texto': '¿Cómo fue la atención recibida?',
            'categoria': 'Atención',
            'orden': 5,
        },
        {
            'texto': '¿Estás satisfecho con el resultado final?',
            'categoria': 'Resultado',
            'orden': 6,
        },
        {
            'texto': '¿Consideras que el precio es justo?',
            'categoria': 'Precio',
            'orden': 7,
        },
        {
            'texto': '¿Qué tan probable es que recomiendes este servicio?',
            'categoria': 'Recomendación',
            'orden': 8,
        },
    ]
    
    creadas = 0
    for pregunta_data in preguntas:
        pregunta, created = EncuestaPregunta.objects.get_or_create(
            texto=pregunta_data['texto'],
            defaults={
                'categoria': pregunta_data['categoria'],
                'orden': pregunta_data['orden'],
                'puntaje_maximo': 10,
                'is_active': True,
            }
        )
        
        if created:
            print(f"✅ Pregunta {pregunta.orden} creada: {pregunta.texto[:50]}...")
            creadas += 1
        else:
            print(f"⚠️  Pregunta {pregunta.orden} ya existe")
    
    print(f"\n📊 Total: {creadas} preguntas nuevas creadas")
    print(f"📋 Total activas: {EncuestaPregunta.objects.filter(is_active=True).count()}")


def crear_encuesta_parametrizada_prueba():
    """Crear una encuesta de prueba con el sistema parametrizado"""
    
    print("\n" + "="*70)
    print("🧪 CREANDO ENCUESTA PARAMETRIZADA DE PRUEBA")
    print("="*70 + "\n")
    
    # Buscar un turno completado sin encuesta
    turno = Turno.objects.filter(
        estado='completado'
    ).exclude(
        id__in=Encuesta.objects.values_list('turno_id', flat=True)
    ).first()
    
    if not turno:
        print("❌ No hay turnos completados disponibles para crear encuesta")
        return
    
    print(f"✅ Turno seleccionado: #{turno.id}")
    print(f"   Cliente: {turno.cliente.nombre_completo}")
    print(f"   Profesional: {turno.empleado.nombre_completo}")
    print(f"   Servicio: {turno.servicio.nombre}")
    
    # Obtener preguntas activas
    preguntas = EncuestaPregunta.objects.filter(is_active=True).order_by('orden')
    
    if not preguntas.exists():
        print("❌ No hay preguntas activas. Ejecuta crear_preguntas_ejemplo() primero")
        return
    
    print(f"\n📋 Preguntas a responder: {preguntas.count()}")
    
    with transaction.atomic():
        # Crear encuesta
        encuesta = Encuesta.objects.create(
            turno=turno,
            cliente=turno.cliente,
            empleado=turno.empleado,
            comentario="Encuesta de prueba creada automáticamente",
            puntaje=0,
        )
        
        print(f"\n✅ Encuesta #{encuesta.id} creada")
        
        # Crear respuestas con valores aleatorios (simulando respuestas reales)
        import random
        total_puntos = 0
        total_maximo = 0
        
        print("\n📝 Respuestas generadas:")
        for pregunta in preguntas:
            # Generar puntaje aleatorio (tendencia positiva: 7-10)
            respuesta_valor = random.randint(7, 10)
            
            RespuestaCliente.objects.create(
                encuesta=encuesta,
                pregunta=pregunta,
                respuesta_valor=respuesta_valor
            )
            
            total_puntos += respuesta_valor
            total_maximo += pregunta.puntaje_maximo
            
            print(f"   [{pregunta.orden}] {pregunta.texto[:50]}... = {respuesta_valor}/10")
        
        # Calcular puntaje normalizado
        if total_maximo > 0:
            encuesta.puntaje = round((total_puntos / total_maximo) * 10, 2)
        
        encuesta.clasificar()
        encuesta.save()
        
        print(f"\n📊 RESULTADO:")
        print(f"   Puntaje total: {total_puntos}/{total_maximo}")
        print(f"   Puntaje normalizado: {encuesta.puntaje}/10")
        print(f"   Clasificación: {encuesta.get_clasificacion_display()}")
    
    # Procesar encuesta (actualizar ranking y verificar alertas)
    from apps.encuestas.tasks import procesar_resultado_encuesta
    
    print(f"\n🔄 Procesando encuesta...")
    try:
        procesar_resultado_encuesta.delay(encuesta.id)
        print("✅ Tarea enviada a Celery")
    except:
        resultado = procesar_resultado_encuesta(encuesta.id)
        print("✅ Procesamiento síncrono completado")
        print(f"   Resultado: {resultado}")
    
    # Mostrar estado actualizado del empleado
    empleado = Empleado.objects.get(id=turno.empleado.id)
    print(f"\n👤 EMPLEADO ACTUALIZADO:")
    print(f"   Nombre: {empleado.nombre_completo}")
    print(f"   Promedio de calificación: {empleado.promedio_calificacion}/10")
    print(f"   Total de encuestas: {empleado.total_encuestas}")


def verificar_sistema():
    """Verificar que el sistema esté configurado correctamente"""
    
    print("\n" + "="*70)
    print("🔍 VERIFICACIÓN DEL SISTEMA PARAMETRIZADO")
    print("="*70 + "\n")
    
    # Verificar configuración
    config = EncuestaConfig.get_config()
    print(f"✅ Configuración activa:")
    print(f"   Umbral negativa: ≤{config.umbral_negativa}")
    print(f"   Umbral neutral: {config.umbral_neutral_min}-{config.umbral_neutral_max}")
    print(f"   Umbral alerta: {config.umbral_notificacion_propietario} negativas en {config.dias_ventana_alerta} días")
    
    # Verificar preguntas
    total_preguntas = EncuestaPregunta.objects.count()
    activas = EncuestaPregunta.objects.filter(is_active=True).count()
    print(f"\n✅ Preguntas:")
    print(f"   Total: {total_preguntas}")
    print(f"   Activas: {activas}")
    
    if activas > 0:
        print(f"\n   Preguntas activas:")
        for p in EncuestaPregunta.objects.filter(is_active=True).order_by('orden'):
            print(f"   [{p.orden}] {p.texto[:60]}...")
    
    # Verificar encuestas parametrizadas
    encuestas_con_respuestas = Encuesta.objects.filter(
        respuestas__isnull=False
    ).distinct().count()
    
    print(f"\n✅ Encuestas:")
    print(f"   Con respuestas parametrizadas: {encuestas_con_respuestas}")
    print(f"   Total de respuestas: {RespuestaCliente.objects.count()}")
    
    # Verificar empleados con ranking
    empleados = Empleado.objects.filter(total_encuestas__gt=0).order_by('-promedio_calificacion')[:5]
    
    if empleados.exists():
        print(f"\n✅ Top 5 Profesionales:")
        for i, emp in enumerate(empleados, 1):
            print(f"   {i}. {emp.nombre_completo}")
            print(f"      Promedio: {emp.promedio_calificacion}/10 | Encuestas: {emp.total_encuestas}")


def menu():
    """Menú interactivo"""
    
    while True:
        print("\n" + "="*70)
        print("🎯 MENÚ - SISTEMA PARAMETRIZADO DE ENCUESTAS")
        print("="*70)
        print("\n1. Verificar sistema")
        print("2. Crear preguntas de ejemplo")
        print("3. Crear encuesta parametrizada de prueba")
        print("4. Ejecutar todo (verificar + crear preguntas + encuesta)")
        print("0. Salir")
        
        opcion = input("\nSelecciona una opción: ").strip()
        
        if opcion == '1':
            verificar_sistema()
        elif opcion == '2':
            crear_preguntas_ejemplo()
        elif opcion == '3':
            crear_encuesta_parametrizada_prueba()
        elif opcion == '4':
            verificar_sistema()
            crear_preguntas_ejemplo()
            crear_encuesta_parametrizada_prueba()
            verificar_sistema()
        elif opcion == '0':
            print("\n👋 ¡Hasta luego!")
            break
        else:
            print("❌ Opción inválida")


if __name__ == '__main__':
    menu()
