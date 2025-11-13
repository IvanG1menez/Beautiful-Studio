#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'beautiful_studio_backend.settings')
django.setup()

from apps.turnos.models import Turno
from apps.empleados.models import Empleado
from datetime import datetime

try:
    emp = Empleado.objects.get(id=718)
    print(f"\n=== Empleado ID 718 ===")
    print(f"Nombre: {emp.user.get_full_name()}")
    print(f"Email: {emp.user.email}")
    print(f"Especialidad: {emp.get_especialidades_display()}")
    
    turnos = Turno.objects.filter(empleado=emp).order_by('-fecha_hora')
    print(f"\nTotal turnos: {turnos.count()}")
    
    if turnos.exists():
        print("\n=== Últimos 10 turnos ===")
        for i, t in enumerate(turnos[:10], 1):
            print(f"{i}. {t.fecha_hora.strftime('%Y-%m-%d %H:%M')} | Cliente: {t.cliente.nombre_completo} | Estado: {t.estado}")
    else:
        print("\n⚠️ NO HAY TURNOS PARA ESTE EMPLEADO")
        
    # Verificar turnos en noviembre 2025
    nov_turnos = Turno.objects.filter(
        empleado=emp,
        fecha_hora__year=2025,
        fecha_hora__month=11
    )
    print(f"\nTurnos en Noviembre 2025: {nov_turnos.count()}")
    
except Empleado.DoesNotExist:
    print("❌ Error: No existe un empleado con ID 718")
