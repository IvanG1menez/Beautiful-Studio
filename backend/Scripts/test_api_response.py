"""Script para verificar que los serializers devuelven los datos correctos"""
import os
import sys
import django

# Configurar Django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.clientes.serializers import ClienteListSerializer
from apps.empleados.serializers import EmpleadoListSerializer
from apps.clientes.models import Cliente
from apps.empleados.models import Empleado

print("=" * 60)
print("VERIFICACIÓN DE SERIALIZERS")
print("=" * 60)

# Probar ClienteListSerializer
print("\n1. CLIENTE:")
print("-" * 60)
cliente = Cliente.objects.select_related('user').first()
if cliente:
    serializer = ClienteListSerializer(cliente)
    data = serializer.data
    
    print(f"✓ ID: {data.get('id')}")
    print(f"✓ nombre_completo: {data.get('nombre_completo')}")
    print(f"✓ user_dni: {data.get('user_dni')}")
    
    if 'user' in data:
        print(f"✓ user (objeto completo): SÍ")
        print(f"  - user.id: {data['user'].get('id')}")
        print(f"  - user.dni: {data['user'].get('dni')}")
        print(f"  - user.email: {data['user'].get('email')}")
    else:
        print("✗ user (objeto completo): NO")
else:
    print("✗ No hay clientes en la base de datos")

# Probar EmpleadoListSerializer
print("\n2. EMPLEADO:")
print("-" * 60)
empleado = Empleado.objects.select_related('user').first()
if empleado:
    serializer = EmpleadoListSerializer(empleado)
    data = serializer.data
    
    print(f"✓ ID: {data.get('id')}")
    print(f"✓ nombre_completo: {data.get('nombre_completo')}")
    print(f"✓ especialidad_display: {data.get('especialidad_display')}")
    
    if 'user' in data:
        print(f"✓ user (objeto completo): SÍ")
        print(f"  - user.id: {data['user'].get('id')}")
        print(f"  - user.dni: {data['user'].get('dni')}")
        print(f"  - user.email: {data['user'].get('email')}")
        print(f"  - user.first_name: {data['user'].get('first_name')}")
        print(f"  - user.last_name: {data['user'].get('last_name')}")
    else:
        print("✗ user (objeto completo): NO")
else:
    print("✗ No hay empleados en la base de datos")

print("\n" + "=" * 60)
print("CONCLUSIÓN:")
print("=" * 60)
print("Si los objetos 'user' se muestran completos arriba,")
print("el frontend ahora debería poder acceder a:")
print("  - cliente.user.dni")
print("  - empleado.user.first_name")
print("  - empleado.user.last_name")
print("  - empleado.nombre_completo")
print("=" * 60)
