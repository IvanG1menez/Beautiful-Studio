"""
Script para crear datos de prueba para el proceso de Optimización de Agenda (Proceso 2)

Crea:
- 2 clientes de prueba
- 1 servicio con reacomodamiento habilitado
- 1 turno futuro confirmado (turno a cancelar)
- 1 turno posterior del mismo servicio (candidato para rellenar el hueco)

Uso:
    python Scripts/test_optimizacion_agenda.py
"""

import os
import sys
import django
from datetime import datetime, timedelta
from decimal import Decimal

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.db import transaction
from django.utils import timezone
from apps.users.models import User
from apps.clientes.models import Cliente
from apps.empleados.models import Empleado
from apps.servicios.models import Servicio, CategoriaServicio, Sala
from apps.turnos.models import Turno
from apps.authentication.models import ConfiguracionGlobal


def crear_datos_optimizacion():
    """Crea datos para probar el proceso de optimización de agenda"""

    print("=" * 70)
    print("🔧 SCRIPT DE PRUEBA: OPTIMIZACIÓN DE AGENDA (PROCESO 2)")
    print("=" * 70)

    with transaction.atomic():
        # ==================== VERIFICAR EMPLEADO ====================
        print("\n👨‍💼 Verificando empleado existente...")
        try:
            empleado = Empleado.objects.first()
            if not empleado:
                print("  ❌ ERROR: No hay empleados en el sistema.")
                print("  → Ejecuta primero: python Scripts/poblar_usuarios_base.py")
                return
            print(f"  ✓ Empleado encontrado: {empleado.user.get_full_name()}")
        except Exception as e:
            print(f"  ❌ Error al buscar empleado: {e}")
            return

        # ==================== SALA Y CATEGORÍA ====================
        print("\n🏢 Verificando sala y categoría...")
        sala, created = Sala.objects.get_or_create(
            nombre="Sala Testing", defaults={"capacidad_simultanea": 2}
        )
        if created:
            print(f"  ✓ Sala creada: {sala.nombre}")
        else:
            print(f"  ✓ Sala encontrada: {sala.nombre}")

        categoria, created = CategoriaServicio.objects.get_or_create(
            nombre="Testing Optimización",
            defaults={
                "descripcion": "Categoría para testing de optimización",
                "sala": sala,
                "is_active": True,
            },
        )
        if created:
            print(f"  ✓ Categoría creada: {categoria.nombre}")
        else:
            print(f"  ✓ Categoría encontrada: {categoria.nombre}")

        # ==================== SERVICIO CON REACOMODAMIENTO ====================
        print("\n💇 Creando servicio con reacomodamiento habilitado...")
        servicio, created = Servicio.objects.get_or_create(
            nombre="Test Reacomodamiento",
            defaults={
                "descripcion": "Servicio de prueba para reacomodamiento",
                "categoria": categoria,
                "precio": Decimal("3000.00"),
                "porcentaje_sena": Decimal("25.00"),
                "duracion_minutos": 45,
                "permite_reacomodamiento": True,  # ← CLAVE PARA PROCESO 2
                "tipo_descuento_adelanto": "PORCENTAJE",
                "valor_descuento_adelanto": Decimal("10.00"),
                "tiempo_espera_respuesta": 15,
                "frecuencia_recurrencia_dias": 30,
                "is_active": True,
            },
        )
        if created:
            print(f"  ✓ Servicio creado: {servicio.nombre}")
            print(f"    - Precio: ${servicio.precio}")
            print(f"    - Permite reacomodamiento: {servicio.permite_reacomodamiento}")
        else:
            servicio.permite_reacomodamiento = True
            servicio.save()
            print(f"  ✓ Servicio actualizado: {servicio.nombre}")

        # ==================== CLIENTES DE PRUEBA ====================
        print("\n👥 Creando clientes de prueba...")

        # Cliente 1: Tendrá el turno a cancelar
        user1, created = User.objects.get_or_create(
            email="test_opt_cliente1@test.com",
            defaults={
                "username": "test_opt_cliente1",
                "first_name": "María",
                "last_name": "González",
                "role": "cliente",
                "phone": "+54 11 9999-0001",
                "is_active": True,
            },
        )
        if created:
            user1.set_password("test123")
            user1.save()

        cliente1, created = Cliente.objects.get_or_create(
            user=user1,
            defaults={
                "direccion": "Av. Test 1234",
                "is_vip": False,
            },
        )
        print(f"  ✓ Cliente 1: {cliente1.nombre_completo} ({user1.email})")

        # Cliente 2: Será el candidato para rellenar el hueco
        user2, created = User.objects.get_or_create(
            email="test_opt_cliente2@test.com",
            defaults={
                "username": "test_opt_cliente2",
                "first_name": "Juan",
                "last_name": "Pérez",
                "role": "cliente",
                "phone": "+54 11 9999-0002",
                "is_active": True,
            },
        )
        if created:
            user2.set_password("test123")
            user2.save()

        cliente2, created = Cliente.objects.get_or_create(
            user=user2,
            defaults={
                "direccion": "Calle Test 5678",
                "is_vip": False,
            },
        )
        print(f"  ✓ Cliente 2: {cliente2.nombre_completo} ({user2.email})")

        # ==================== CONFIGURACIÓN GLOBAL ====================
        print("\n⚙️  Verificando configuración global...")
        config = ConfiguracionGlobal.get_config()
        print(
            f"  ✓ Horas mínimas para crédito: {config.min_horas_cancelacion_credito}hs"
        )

        # ==================== TURNOS DE PRUEBA ====================
        print("\n📅 Creando turnos de prueba...")

        # Calcular fechas
        # Turno a cancelar: dentro de 5 días a las 14:00
        fecha_turno_cancelar = timezone.now() + timedelta(days=5)
        fecha_turno_cancelar = fecha_turno_cancelar.replace(
            hour=14, minute=0, second=0, microsecond=0
        )

        # Turno candidato: 10 días después del anterior, a las 16:00
        fecha_turno_candidato = fecha_turno_cancelar + timedelta(days=10)
        fecha_turno_candidato = fecha_turno_candidato.replace(
            hour=16, minute=0, second=0, microsecond=0
        )

        # Turno 1: A CANCELAR (Cliente 1)
        turno1, created = Turno.objects.get_or_create(
            cliente=cliente1,
            empleado=empleado,
            servicio=servicio,
            fecha_hora=fecha_turno_cancelar,
            defaults={
                "sala": sala,
                "estado": "confirmado",
                "precio_final": servicio.precio,
                "notas_empleado": "Turno de prueba para cancelar y activar proceso 2",
            },
        )

        if created:
            print(f"\n  ✓ TURNO A CANCELAR (ID: {turno1.id}):")
            print(f"    - Cliente: {cliente1.nombre_completo}")
            print(f"    - Fecha: {turno1.fecha_hora.strftime('%d/%m/%Y %H:%M')}")
            print(f"    - Estado: {turno1.estado}")
            print(f"    - Precio: ${turno1.precio_final}")
            print(f"    - Servicio: {servicio.nombre}")
        else:
            print(f"\n  ⚠️  Turno ya existe (ID: {turno1.id})")

        # Turno 2: CANDIDATO para rellenar (Cliente 2)
        turno2, created = Turno.objects.get_or_create(
            cliente=cliente2,
            empleado=empleado,
            servicio=servicio,
            fecha_hora=fecha_turno_candidato,
            defaults={
                "sala": sala,
                "estado": "confirmado",
                "precio_final": servicio.precio,
                "notas_empleado": "Candidato para recibir propuesta de adelanto",
            },
        )

        if created:
            print(f"\n  ✓ TURNO CANDIDATO (ID: {turno2.id}):")
            print(f"    - Cliente: {cliente2.nombre_completo}")
            print(f"    - Fecha: {turno2.fecha_hora.strftime('%d/%m/%Y %H:%M')}")
            print(f"    - Estado: {turno2.estado}")
            print(f"    - Este cliente recibirá la propuesta de adelanto")
        else:
            print(f"\n  ⚠️  Turno candidato ya existe (ID: {turno2.id})")

        # ==================== RESUMEN ====================
        print("\n" + "=" * 70)
        print("✅ DATOS CREADOS EXITOSAMENTE")
        print("=" * 70)
        print("\n📋 INSTRUCCIONES PARA PROBAR:")
        print("\n1. Ve a: http://localhost:3000/dashboard/propietario/diagnostico")
        print(f"2. En 'Optimización de Agenda' ingresa el turno ID: {turno1.id}")
        print("3. Click en 'Gatillar Optimización de Agenda'")
        print("\n🔍 FLUJO ESPERADO:")
        print(f"   ✓ Paso 1: Cancelar turno #{turno1.id}")
        print(
            f"   ✓ Paso 2: Acreditar ${servicio.precio} a billetera de {cliente1.nombre_completo}"
        )
        print(f"   ✓ Paso 3: Enviar propuesta de adelanto a {cliente2.nombre_completo}")
        print("\n💡 NOTA: El crédito se aplicará porque el turno está a >48hs")
        print("=" * 70)

        return turno1.id


if __name__ == "__main__":
    try:
        turno_id = crear_datos_optimizacion()
        print(f"\n🎯 ID del turno a usar en testing: {turno_id}")
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback

        traceback.print_exc()
