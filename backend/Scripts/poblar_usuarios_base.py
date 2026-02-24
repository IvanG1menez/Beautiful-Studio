import os
import sys
import django
from datetime import date, time

# Agregar el directorio backend al path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.db import transaction
from apps.users.models import User
from apps.empleados.models import Empleado, EmpleadoServicio
from apps.clientes.models import Cliente
from apps.servicios.models import Sala, CategoriaServicio, Servicio


# Emails protegidos que no se deben borrar
USUARIOS_BASE = [
    "propietario@beautifulstudio.com",
    "empleado1@beautifulstudio.com",
    "cliente1@beautifulstudio.com",
]


def crear_usuarios_base():
    """
    Crea los 3 usuarios base del sistema: propietario, profesional y cliente
    """
    with transaction.atomic():
        print("🔄 Creando usuarios base del sistema...\n")
        
        # ==================== PROPIETARIO ====================
        print("👤 Creando usuario propietario...")
        propietario, created = User.objects.get_or_create(
            email="propietario@beautifulstudio.com",
            defaults={
                "username": "propietario",
                "first_name": "Admin",
                "last_name": "BeautifulStudio",
                "role": "propietario",
                "phone": "+54 11 1234-5678",
                "is_staff": True,
                "is_active": True,
            }
        )
        if created:
            propietario.set_password("propietario123")
            propietario.save()
            print(f"  ✓ Propietario creado: {propietario.email}")
        else:
            print(f"  ⚠️  Propietario ya existe: {propietario.email}")
        
        # ==================== SALA Y CATEGORÍA ====================
        print("\n🏢 Creando sala y categoría de servicio...")
        sala, _ = Sala.objects.get_or_create(
            nombre="Sala Principal",
            defaults={"capacidad_simultanea": 3}
        )
        print(f"  ✓ Sala: {sala.nombre}")
        
        categoria, _ = CategoriaServicio.objects.get_or_create(
            nombre="Corte y Peinado",
            defaults={
                "descripcion": "Servicios de corte y peinado profesional",
                "sala": sala,
                "is_active": True
            }
        )
        print(f"  ✓ Categoría: {categoria.nombre}")
        
        # ==================== SERVICIO ====================
        print("\n💇 Creando servicio...")
        servicio, _ = Servicio.objects.get_or_create(
            nombre="Corte de Cabello",
            defaults={
                "descripcion": "Corte de cabello profesional",
                "categoria": categoria,
                "precio": 5000.00,
                "duracion_minutos": 60,
                "is_active": True
            }
        )
        print(f"  ✓ Servicio: {servicio.nombre} - ${servicio.precio}")
        
        # ==================== PROFESIONAL ====================
        print("\n👨‍💼 Creando usuario profesional...")
        profesional_user, created = User.objects.get_or_create(
            email="empleado1@beautifulstudio.com",
            defaults={
                "username": "empleado1",
                "first_name": "Carlos",
                "last_name": "Rodríguez",
                "role": "profesional",
                "phone": "+54 11 2345-6789",
                "is_active": True,
            }
        )
        if created:
            profesional_user.set_password("empleado123")
            profesional_user.save()
            print(f"  ✓ Usuario profesional creado: {profesional_user.email}")
        else:
            print(f"  ⚠️  Usuario profesional ya existe: {profesional_user.email}")
        
        # Crear perfil Empleado
        empleado, created = Empleado.objects.get_or_create(
            user=profesional_user,
            defaults={
                "fecha_ingreso": date.today(),
                "horario_entrada": time(9, 0),
                "horario_salida": time(18, 0),
                "dias_trabajo": "L,M,X,J,V",
                "comision_porcentaje": 30.00,
                "is_disponible": True,
                "biografia": "Especialista en corte y peinado con 5 años de experiencia",
                "promedio_calificacion": 9.5,
                "total_encuestas": 0
            }
        )
        if created:
            print(f"  ✓ Perfil empleado creado para {empleado.nombre_completo}")
        else:
            print(f"  ⚠️  Perfil empleado ya existe para {empleado.nombre_completo}")
        
        # Asociar empleado con servicio
        empleado_servicio, created = EmpleadoServicio.objects.get_or_create(
            empleado=empleado,
            servicio=servicio,
            defaults={"nivel_experiencia": 3}  # Avanzado
        )
        if created:
            print(f"  ✓ Servicio '{servicio.nombre}' asociado al profesional")
        else:
            print(f"  ⚠️  Servicio ya estaba asociado al profesional")
        
        # ==================== CLIENTE ====================
        print("\n👥 Creando usuario cliente...")
        cliente_user, created = User.objects.get_or_create(
            email="cliente1@beautifulstudio.com",
            defaults={
                "username": "cliente1",
                "first_name": "María",
                "last_name": "González",
                "role": "cliente",
                "phone": "+54 11 3456-7890",
                "is_active": True,
            }
        )
        if created:
            cliente_user.set_password("cliente123")
            cliente_user.save()
            print(f"  ✓ Usuario cliente creado: {cliente_user.email}")
        else:
            print(f"  ⚠️  Usuario cliente ya existe: {cliente_user.email}")
        
        # Crear perfil Cliente
        cliente, created = Cliente.objects.get_or_create(
            user=cliente_user,
            defaults={
                "fecha_nacimiento": date(1990, 5, 15),
                "direccion": "Av. Corrientes 1234, CABA",
                "preferencias": "Prefiere turnos por la mañana",
                "is_vip": False
            }
        )
        if created:
            print(f"  ✓ Perfil cliente creado para {cliente.nombre_completo}")
        else:
            print(f"  ⚠️  Perfil cliente ya existe para {cliente.nombre_completo}")
        
        print("\n" + "="*60)
        print("✅ USUARIOS BASE CREADOS EXITOSAMENTE")
        print("="*60)
        print("\n📋 CREDENCIALES:")
        print("\n🔑 PROPIETARIO:")
        print("   Email: propietario@beautifulstudio.com")
        print("   Contraseña: propietario123")
        print("\n🔑 PROFESIONAL:")
        print("   Email: empleado1@beautifulstudio.com")
        print("   Contraseña: empleado123")
        print("\n🔑 CLIENTE:")
        print("   Email: cliente1@beautifulstudio.com")
        print("   Contraseña: cliente123")
        print("\n" + "="*60)


if __name__ == "__main__":
    try:
        crear_usuarios_base()
    except Exception as e:
        print(f"\n❌ Error al crear usuarios base: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
