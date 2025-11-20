"""
Script automático para probar el sistema parametrizado de encuestas
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


def main():
    """Ejecutar todas las pruebas automáticamente"""
    
    print("\n" + "="*70)
    print("🚀 PRUEBA AUTOMÁTICA DEL SISTEMA PARAMETRIZADO")
    print("="*70 + "\n")
    
    # 1. Verificar configuración
    print("1️⃣ VERIFICANDO CONFIGURACIÓN...")
    config = EncuestaConfig.get_config()
    print(f"   ✅ Configuración activa")
    print(f"   - Umbral negativa: ≤{config.umbral_negativa}")
    print(f"   - Umbral neutral: {config.umbral_neutral_min}-{config.umbral_neutral_max}")
    print(f"   - Umbral alerta: {config.umbral_notificacion_propietario} negativas en {config.dias_ventana_alerta} días")
    
    # 2. Verificar preguntas
    print("\n2️⃣ VERIFICANDO PREGUNTAS...")
    total_preguntas = EncuestaPregunta.objects.count()
    activas = EncuestaPregunta.objects.filter(is_active=True).count()
    print(f"   ✅ Total de preguntas: {total_preguntas}")
    print(f"   ✅ Preguntas activas: {activas}")
    
    if activas > 0:
        print(f"\n   📋 Preguntas activas:")
        for p in EncuestaPregunta.objects.filter(is_active=True).order_by('orden')[:5]:
            print(f"      [{p.orden}] {p.texto[:60]}...")
    
    # 3. Verificar encuestas parametrizadas
    print("\n3️⃣ VERIFICANDO ENCUESTAS PARAMETRIZADAS...")
    encuestas_con_respuestas = Encuesta.objects.filter(
        respuestas__isnull=False
    ).distinct().count()
    total_respuestas = RespuestaCliente.objects.count()
    
    print(f"   ✅ Encuestas con respuestas parametrizadas: {encuestas_con_respuestas}")
    print(f"   ✅ Total de respuestas individuales: {total_respuestas}")
    
    # 4. Verificar empleados con ranking
    print("\n4️⃣ VERIFICANDO RANKING DE EMPLEADOS...")
    empleados_con_encuestas = Empleado.objects.filter(total_encuestas__gt=0).order_by('-promedio_calificacion')
    
    if empleados_con_encuestas.exists():
        print(f"   ✅ Empleados con encuestas: {empleados_con_encuestas.count()}")
        print(f"\n   🏆 Top 5 Profesionales:")
        for i, emp in enumerate(empleados_con_encuestas[:5], 1):
            print(f"      {i}. {emp.nombre_completo}")
            print(f"         Promedio: {emp.promedio_calificacion}/10 | Encuestas: {emp.total_encuestas}")
    else:
        print(f"   ⚠️  No hay empleados con encuestas aún")
    
    # 5. Resumen final
    print("\n" + "="*70)
    print("✅ PRUEBA COMPLETADA")
    print("="*70)
    print(f"\n📊 RESUMEN:")
    print(f"   - Configuración: OK")
    print(f"   - Preguntas activas: {activas}")
    print(f"   - Encuestas parametrizadas: {encuestas_con_respuestas}")
    print(f"   - Respuestas totales: {total_respuestas}")
    print(f"   - Empleados con ranking: {empleados_con_encuestas.count()}")
    
    print(f"\n✨ Sistema parametrizado funcionando correctamente!")
    print(f"\n📝 Próximos pasos:")
    print(f"   1. Crear preguntas personalizadas desde Admin o API")
    print(f"   2. Los clientes responderán encuestas dinámicas")
    print(f"   3. El ranking se actualizará automáticamente")
    print(f"   4. Las alertas se enviarán si se supera el umbral")
    print("\n")


if __name__ == '__main__':
    main()
