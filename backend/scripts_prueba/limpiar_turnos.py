"""
Script para eliminar turnos duplicados y pendientes de prueba
"""
import os
import sys
import django

# Setup Django
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'beautiful_studio_backend.settings')
django.setup()

from apps.turnos.models import Turno
from django.utils import timezone
from datetime import timedelta

print("\n=== LIMPIEZA DE TURNOS ===\n")

# Mostrar turnos pendientes
turnos_pendientes = Turno.objects.filter(estado='pendiente').order_by('-created_at')
print(f"Total de turnos pendientes: {turnos_pendientes.count()}\n")

if turnos_pendientes.count() > 0:
    print("Últimos 10 turnos pendientes:")
    for turno in turnos_pendientes[:10]:
        print(f"  ID: {turno.id} | Cliente: {turno.cliente.user.email} | Empleado: {turno.empleado.user.first_name} | Fecha: {turno.fecha_hora} | Creado: {turno.created_at}")

    respuesta = input("\n¿Deseas eliminar TODOS los turnos pendientes? (s/n): ")
    if respuesta.lower() == 's':
        count = turnos_pendientes.count()
        turnos_pendientes.delete()
        print(f"\n✅ Se eliminaron {count} turnos pendientes")
    else:
        print("\n❌ Operación cancelada")
else:
    print("No hay turnos pendientes para eliminar")

print("\n=== FIN ===\n")
