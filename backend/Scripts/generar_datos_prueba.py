"""
Script para generar datos de prueba: 10 clientes y 10 profesionales
Ejecutar desde la carpeta backend: python Scripts/generar_datos_prueba.py
"""

import os
import sys
import django
from datetime import date, time, datetime, timedelta
from random import choice, randint

# Configurar Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.users.models import User
from apps.clientes.models import Cliente
from apps.empleados.models import Empleado


def generar_clientes():
    """Genera 10 clientes de prueba"""
    print("=" * 60)
    print("Generando 10 clientes...")
    print("=" * 60)
    
    nombres = ["Ana", "Carlos", "María", "Luis", "Laura", "Diego", "Sofía", "Javier", "Valentina", "Martín"]
    apellidos = ["González", "Rodríguez", "Fernández", "López", "Martínez", "García", "Pérez", "Sánchez", "Romero", "Torres"]
    
    clientes_creados = 0
    
    for i in range(10):
        nombre = nombres[i]
        apellido = apellidos[i]
        email = f"cliente{i+1}@beautifulstudio.com"
        dni = f"3000000{i+1}"
        
        # Verificar si el usuario ya existe
        if User.objects.filter(email=email).exists():
            print(f"⚠️  Cliente {email} ya existe, saltando...")
            continue
        
        try:
            # Crear usuario
            user = User.objects.create_user(
                email=email,
                password="cliente123",
                first_name=nombre,
                last_name=apellido,
                username=f"cliente{i+1}",
                dni=dni,
                phone=f"+54911{randint(1000,9999)}{randint(1000,9999)}",
                role="cliente",
                is_active=True
            )
            
            # Crear perfil de cliente
            cliente = Cliente.objects.create(
                user=user,
                fecha_nacimiento=date(1990 + randint(0, 20), randint(1, 12), randint(1, 28)),
                direccion=f"Calle Ejemplo {randint(100, 9999)}, Buenos Aires",
                preferencias=f"Cliente preferencial de {choice(['cortes', 'color', 'tratamientos', 'maquillaje'])}",
                fecha_primera_visita=datetime.now() - timedelta(days=randint(30, 365)),
                is_vip=choice([True, False])
            )
            
            clientes_creados += 1
            print(f"✅ Cliente creado: {user.full_name} ({email})")
            
        except Exception as e:
            print(f"❌ Error al crear cliente {email}: {str(e)}")
    
    print(f"\n✔️  Total clientes creados: {clientes_creados}/10")
    return clientes_creados


def generar_empleados():
    """Genera 10 profesionales de prueba"""
    print("\n" + "=" * 60)
    print("Generando 10 profesionales...")
    print("=" * 60)
    
    nombres = ["Adriana", "Roberto", "Patricia", "Fernando", "Gabriela", "Sebastián", "Daniela", "Gustavo", "Carolina", "Alejandro"]
    apellidos = ["Silva", "Castro", "Morales", "Ruiz", "Vega", "Navarro", "Méndez", "Flores", "Herrera", "Medina"]
    
    empleados_creados = 0
    
    for i in range(10):
        nombre = nombres[i]
        apellido = apellidos[i]
        email = f"empleado{i+1}@beautifulstudio.com"
        dni = f"2000000{i+1}"
        
        # Verificar si el usuario ya existe
        if User.objects.filter(email=email).exists():
            print(f"⚠️  Profesional {email} ya existe, saltando...")
            continue
        
        try:
            # Crear usuario
            user = User.objects.create_user(
                email=email,
                password="empleado123",
                first_name=nombre,
                last_name=apellido,
                username=f"empleado{i+1}",
                dni=dni,
                phone=f"+54911{randint(1000,9999)}{randint(1000,9999)}",
                role="profesional",
                is_active=True
            )
            
            # Crear perfil de empleado/profesional
            empleado = Empleado.objects.create(
                user=user,
                fecha_ingreso=date(2020 + randint(0, 5), randint(1, 12), randint(1, 28)),
                horario_entrada=time(9, 0),
                horario_salida=time(18, 0),
                dias_trabajo="L,M,M,J,V",
                comision_porcentaje=choice([10.00, 15.00, 20.00, 25.00]),
                is_disponible=True,
                biografia=f"Profesional especializado en servicios de belleza con {randint(5, 15)} años de experiencia.",
                promedio_calificacion=round(randint(70, 100) / 10, 2),
                total_encuestas=randint(10, 100)
            )
            
            empleados_creados += 1
            print(f"✅ Profesional creado: {user.full_name} ({email})")
            
        except Exception as e:
            print(f"❌ Error al crear profesional {email}: {str(e)}")
    
    print(f"\n✔️  Total profesionales creados: {empleados_creados}/10")
    return empleados_creados


def main():
    """Función principal"""
    print("\n" + "🎨" * 30)
    print("  GENERADOR DE DATOS DE PRUEBA - BEAUTIFUL STUDIO")
    print("🎨" * 30 + "\n")
    
    print("📋 Contraseñas genéricas:")
    print("   • Clientes: cliente123")
    print("   • Profesionales: empleado123\n")
    
    # Generar datos
    clientes_creados = generar_clientes()
    empleados_creados = generar_empleados()
    
    # Resumen final
    print("\n" + "=" * 60)
    print("📊 RESUMEN FINAL")
    print("=" * 60)
    print(f"✅ Clientes creados: {clientes_creados}/10")
    print(f"✅ Profesionales creados: {empleados_creados}/10")
    print(f"📧 Total usuarios: {clientes_creados + empleados_creados}")
    
    print("\n" + "🔐" * 30)
    print("CREDENCIALES DE ACCESO:")
    print("🔐" * 30)
    print("\n📧 CLIENTES:")
    for i in range(1, 11):
        print(f"   Email: cliente{i}@beautifulstudio.com | Password: cliente123")
    
    print("\n👨‍💼 PROFESIONALES:")
    for i in range(1, 11):
        print(f"   Email: empleado{i}@beautifulstudio.com | Password: empleado123")
    
    print("\n✨ Datos generados exitosamente! ✨\n")


if __name__ == "__main__":
    main()
