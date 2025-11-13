#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'beautiful_studio_backend.settings')
django.setup()

from apps.empleados.models import Empleado

print("\n=== EMPLEADOS EN LA BASE DE DATOS ===\n")
empleados = Empleado.objects.all().select_related('user')

if empleados.exists():
    for emp in empleados:
        print(f"ID: {emp.id}")
        print(f"  Nombre: {emp.user.get_full_name()}")
        print(f"  Username: {emp.user.username}")
        print(f"  Email: {emp.user.email}")
        print(f"  Especialidad: {emp.get_especialidades_display()}")
        print(f"  User ID: {emp.user.id}")
        print()
else:
    print("⚠️ NO HAY EMPLEADOS EN LA BASE DE DATOS")
