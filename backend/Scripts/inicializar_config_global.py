"""
Script para inicializar la configuración global del sistema
Crea el registro único de ConfiguracionGlobal con valores por defecto
"""

import os
import sys
import django

# Configurar el entorno de Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.authentication.models import ConfiguracionGlobal


def inicializar_configuracion_global():
    """Crear o actualizar la configuración global con valores por defecto"""
    
    print("=" * 60)
    print("INICIALIZANDO CONFIGURACIÓN GLOBAL")
    print("=" * 60)
    
    # Obtener o crear configuración (método singleton)
    config = ConfiguracionGlobal.get_config()
    
    print(f"\nConfiguracion Global ID: {config.id}")
    print(f"Creado: {config.created_at}")
    print(f"Actualizado: {config.updated_at}")
    print("\n" + "-" * 60)
    print("PARÁMETROS ACTUALES:")
    print("-" * 60)
    
    print("\n🔹 Reglas de Billetera Virtual:")
    print(f"   - Horas mínimas para crédito: {config.min_horas_cancelacion_credito}h")
    
    print("\n🔹 Parámetros de Reincorporación:")
    print(f"   - Días de inactividad: {config.margen_fidelizacion_dias} días")
    print(f"   - Descuento fidelización: {config.descuento_fidelizacion_pct}%")
    
    print("\n🔹 Capacidad del Local:")
    print(f"   - Capacidad máxima global: {config.capacidad_maxima_global}")
    if config.capacidad_maxima_global == 0:
        print("     (0 = sin límite global, solo se usa capacidad de salas)")
    
    print("\n" + "-" * 60)
    print(f"Estado: {'✅ Activo' if config.activo else '❌ Inactivo'}")
    print("-" * 60)
    
    print("\n✅ Configuración global inicializada correctamente")
    print("\nPuedes modificar estos valores desde:")
    print("   - Admin Django: /admin/authentication/configuracionglobal/")
    print("   - Frontend: Dashboard Propietario > Configuración > Pestaña General")
    print("\n" + "=" * 60)


if __name__ == "__main__":
    try:
        inicializar_configuracion_global()
    except Exception as e:
        print(f"\n❌ Error al inicializar configuración: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
