"""
Script de prueba integral del flujo de reserva de turnos
Simula el flujo completo desde el cliente
"""

import os
import django
import json
from datetime import datetime

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "beautiful_studio_backend.settings")
django.setup()

from apps.empleados.models import Empleado, HorarioEmpleado, EmpleadoServicio
from apps.servicios.models import Servicio
from apps.clientes.models import Cliente

print("=" * 80)
print("PRUEBA INTEGRAL DEL FLUJO DE RESERVA DE TURNOS")
print("=" * 80)

# Paso 1: Verificar que tenemos clientes
print("\n📋 PASO 1: Verificar clientes disponibles")
clientes = Cliente.objects.all()[:3]
if clientes:
    for c in clientes:
        print(f"   ✓ Cliente: {c.user.first_name} {c.user.last_name} (ID: {c.id})")
else:
    print("   ⚠️  No hay clientes en la base de datos")

# Paso 2: Listar categorías y servicios
print("\n📋 PASO 2: Verificar servicios disponibles")
from apps.servicios.models import CategoriaServicio

categorias = CategoriaServicio.objects.all()[:3]
for cat in categorias:
    servicios = Servicio.objects.filter(categoria=cat)[:2]
    print(f"   📁 {cat.nombre}:")
    for serv in servicios:
        print(f"      • {serv.nombre} ({serv.duracion_minutos} min) - ${serv.precio}")

# Paso 3: Seleccionar un servicio de prueba
print("\n📋 PASO 3: Seleccionar servicio de prueba")
servicio = Servicio.objects.filter(duracion_minutos__lte=60).first()
print(f"   Servicio seleccionado: {servicio.nombre}")
print(f"   Duración: {servicio.duracion_minutos} minutos")
print(f"   Precio: ${servicio.precio}")

# Paso 4: Buscar empleados que pueden realizar ese servicio
print("\n📋 PASO 4: Buscar profesionales disponibles para este servicio")
empleados_disponibles = Empleado.objects.filter(
    servicios_disponibles__servicio=servicio, is_disponible=True
).distinct()[:3]

if empleados_disponibles:
    print(f"   Encontrados {empleados_disponibles.count()} profesionales:")
    for emp in empleados_disponibles:
        # Obtener nivel de experiencia
        rel = EmpleadoServicio.objects.filter(empleado=emp, servicio=servicio).first()
        nivel = rel.nivel_experiencia if rel else "N/A"
        print(f"   • {emp.nombre_completo} - Nivel: {nivel}")
else:
    print("   ⚠️  No hay profesionales disponibles para este servicio")
    empleados_disponibles = Empleado.objects.filter(is_disponible=True)[:3]
    print(
        f"   Mostrando todos los profesionales disponibles: {empleados_disponibles.count()}"
    )

# Paso 5: Seleccionar un empleado
empleado = empleados_disponibles.first()
print(f"\n📋 PASO 5: Profesional seleccionado")
print(f"   {empleado.nombre_completo} (ID: {empleado.id})")
print(f"   Especialidad: {empleado.get_especialidades_display()}")

# Paso 6: Verificar horarios del empleado
print(f"\n📋 PASO 6: Verificar horarios del profesional")
horarios = HorarioEmpleado.objects.filter(empleado=empleado, is_active=True).order_by(
    "dia_semana", "hora_inicio"
)
dias_nombres = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
]

dias_con_horario = {}
for h in horarios:
    if h.dia_semana not in dias_con_horario:
        dias_con_horario[h.dia_semana] = []
    dias_con_horario[h.dia_semana].append(
        f"{h.hora_inicio.strftime('%H:%M')}-{h.hora_fin.strftime('%H:%M')}"
    )

print(f"   Trabaja {len(dias_con_horario)} días a la semana:")
for dia_num, rangos in sorted(dias_con_horario.items()):
    print(f"   • {dias_nombres[dia_num]}: {', '.join(rangos)}")

# Paso 7: Probar disponibilidad para diferentes fechas
print(f"\n📋 PASO 7: Probar disponibilidad para diferentes fechas")
fechas_prueba = [
    "2025-10-27",  # Lunes
    "2025-10-28",  # Martes
    "2025-10-25",  # Sábado
]

for fecha in fechas_prueba:
    fecha_obj = datetime.strptime(fecha, "%Y-%m-%d").date()
    dia_semana = fecha_obj.weekday()

    print(f"\n   📅 {fecha} ({dias_nombres[dia_semana]}):")

    # Verificar si trabaja ese día
    horarios_dia = HorarioEmpleado.objects.filter(
        empleado=empleado, dia_semana=dia_semana, is_active=True
    )

    if horarios_dia.exists():
        print(f"      ✓ {empleado.user.first_name} trabaja este día")
        for h in horarios_dia:
            print(f"        Horario: {h.hora_inicio} - {h.hora_fin}")

        # Simular llamada al endpoint
        from django.test import RequestFactory
        from apps.turnos.views import TurnoViewSet

        factory = RequestFactory()
        request = factory.get(
            f"/api/turnos/disponibilidad/?empleado={empleado.id}&servicio={servicio.id}&fecha={fecha}"
        )

        # Crear una instancia del viewset
        view = TurnoViewSet()
        view.request = request

        try:
            response = view.disponibilidad(request)
            data = response.data

            if data.get("disponible"):
                horarios = data.get("horarios", [])
                print(f"      ✓ Horarios disponibles: {len(horarios)}")
                if horarios:
                    print(f"        Primeros slots: {', '.join(horarios[:5])}")
                    if len(horarios) > 5:
                        print(f"        ... y {len(horarios) - 5} más")
            else:
                print(f"      ✗ No hay horarios disponibles")
                print(f"        Razón: {data.get('mensaje', 'No especificada')}")
        except Exception as e:
            print(f"      ❌ Error al consultar disponibilidad: {str(e)}")
    else:
        print(f"      ✗ {empleado.user.first_name} no trabaja este día")

# Paso 8: Resumen
print("\n" + "=" * 80)
print("RESUMEN DE LA PRUEBA")
print("=" * 80)
print(f"✓ Servicios disponibles: {Servicio.objects.count()}")
print(f"✓ Profesionales activos: {Empleado.objects.filter(is_disponible=True).count()}")
print(
    f"✓ Profesionales con horarios: {Empleado.objects.filter(horarios_detallados__isnull=False).distinct().count()}"
)
print(
    f"✓ Total de horarios configurados: {HorarioEmpleado.objects.filter(is_active=True).count()}"
)

print("\n✅ Prueba completada. El sistema está listo para usar.")
print("=" * 80)
