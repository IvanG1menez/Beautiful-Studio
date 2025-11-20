#!/usr/bin/env python
"""Script para ver horarios detallados de empleados"""
import os
import sys
import django

# Setup Django - agregar el directorio padre
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'beautiful_studio_backend.settings')
django.setup()

from apps.empleados.models import HorarioEmpleado

# Obtener horarios
horarios = HorarioEmpleado.objects.select_related('empleado__user').all()[:20]

print(f'\n=== HORARIOS DETALLADOS (Total: {HorarioEmpleado.objects.count()}) ===\n')

for h in horarios:
    print(f'ID: {h.id}')
    print(f'Empleado: {h.empleado.user.first_name} {h.empleado.user.last_name} (ID: {h.empleado.id})')
    print(f'Día: {h.get_dia_semana_display()} ({h.dia_semana})')
    print(f'Horario: {h.hora_inicio.strftime("%H:%M")} - {h.hora_fin.strftime("%H:%M")}')
    print(f'Activo: {h.is_active}')
    print('-' * 50)
