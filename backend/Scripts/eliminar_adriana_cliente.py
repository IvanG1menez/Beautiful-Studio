"""
Script para eliminar a Adriana Cruz de la tabla de clientes
"""

import os
import sys
import django

# Configurar Django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.clientes.models import Cliente

# Buscar y eliminar a Adriana Cruz
try:
    adriana = Cliente.objects.get(user__first_name='Adriana', user__last_name='Cruz')
    print(f"Encontrada: {adriana.nombre_completo}")
    print(f"Email: {adriana.user.email}")
    print(f"ID: {adriana.id}")
    
    confirmacion = input("\n¿Deseas eliminar este cliente? (s/n): ")
    if confirmacion.lower() == 's':
        adriana.delete()
        print("✅ Cliente eliminado exitosamente")
    else:
        print("❌ Operación cancelada")
except Cliente.DoesNotExist:
    print("❌ No se encontró el cliente Adriana Cruz")
except Exception as e:
    print(f"❌ Error: {str(e)}")
