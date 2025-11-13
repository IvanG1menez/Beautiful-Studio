#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'beautiful_studio_backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from apps.empleados.models import Empleado
from datetime import date

User = get_user_model()

print("\n=== Creando perfil de empleado para Ivan Gimenez ===\n")

# Crear un nuevo usuario profesional o usar uno existente
try:
    # Intentar crear un nuevo usuario profesional
    user = User.objects.create_user(
        username='ivan.profesional',
        email='ivan.profesional@beautifulstudio.com',
        password='profesional123',
        first_name='Ivan',
        last_name='Gimenez',
        role='profesional',
        phone='+54 9 11 9999-8888',
        dni='99999999'
    )
    print(f"✅ Usuario creado: {user.username}")
except:
    # Si ya existe, usarlo
    user = User.objects.get(username='ivan.profesional')
    print(f"ℹ️  Usuario existente: {user.username}")

# Verificar si ya tiene perfil de empleado
try:
    empleado = Empleado.objects.get(user=user)
    print(f"ℹ️  Ya existe empleado con ID: {empleado.id}")
except Empleado.DoesNotExist:
    # Crear perfil de empleado
    empleado = Empleado.objects.create(
        user=user,
        especialidades='corte',
        fecha_ingreso=date(2024, 1, 15),
        horario_entrada='09:00',
        horario_salida='18:00',
        dias_trabajo='L,M,Mi,J,V',
        comision_porcentaje=28.00,
        is_disponible=True,
        biografia='Profesional con experiencia en corte y peinado'
    )
    print(f"✅ Empleado creado con ID: {empleado.id}")

print(f"\n📋 DATOS PARA LOGIN:")
print(f"   Username: ivan.profesional")
print(f"   Password: profesional123")
print(f"   Empleado ID: {empleado.id}")
print(f"   User ID: {user.id}")
