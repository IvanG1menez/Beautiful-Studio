"""
Script para crear datos de prueba para el proceso de Fidelización de Clientes (Proceso 1)

Crea:
- 4 clientes de prueba con diferentes niveles de inactividad
- Turnos completados hace 45-90 días
- Servicios con diferentes frecuencias de recurrencia

Uso:
    python Scripts/test_fidelizacion_clientes.py
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


def crear_datos_fidelizacion():
    """Crea datos para probar el proceso de fidelización de clientes"""

    print("=" * 70)
    print("💙 SCRIPT DE PRUEBA: FIDELIZACIÓN DE CLIENTES (PROCESO 1)")
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
            nombre="Testing Fidelización",
            defaults={
                "descripcion": "Categoría para testing de fidelización",
                "sala": sala,
                "is_active": True,
            },
        )
        if created:
            print(f"  ✓ Categoría creada: {categoria.nombre}")
        else:
            print(f"  ✓ Categoría encontrada: {categoria.nombre}")

        # ==================== SERVICIOS CON DIFERENTES FRECUENCIAS ====================
        print("\n💇 Creando servicios con diferentes frecuencias de retorno...")

        # Servicio 1: Frecuencia 30 días (Corte)
        servicio_30dias, created = Servicio.objects.get_or_create(
            nombre="Test Corte (30 días)",
            defaults={
                "descripcion": "Servicio con frecuencia de 30 días",
                "categoria": categoria,
                "precio": Decimal("2500.00"),
                "duracion_minutos": 45,
                "frecuencia_recurrencia_dias": 30,  # ← Frecuencia personalizada
                "is_active": True,
            },
        )
        if created:
            print(
                f"  ✓ {servicio_30dias.nombre} - Frecuencia: {servicio_30dias.frecuencia_recurrencia_dias} días"
            )

        # Servicio 2: Frecuencia 60 días (Coloración)
        servicio_60dias, created = Servicio.objects.get_or_create(
            nombre="Test Coloración (60 días)",
            defaults={
                "descripcion": "Servicio con frecuencia de 60 días",
                "categoria": categoria,
                "precio": Decimal("4500.00"),
                "duracion_minutos": 90,
                "frecuencia_recurrencia_dias": 60,  # ← Frecuencia personalizada
                "is_active": True,
            },
        )
        if created:
            print(
                f"  ✓ {servicio_60dias.nombre} - Frecuencia: {servicio_60dias.frecuencia_recurrencia_dias} días"
            )

        # Servicio 3: Sin frecuencia (usa global)
        servicio_global, created = Servicio.objects.get_or_create(
            nombre="Test Tratamiento (Global)",
            defaults={
                "descripcion": "Servicio que usa configuración global",
                "categoria": categoria,
                "precio": Decimal("3500.00"),
                "duracion_minutos": 60,
                "frecuencia_recurrencia_dias": 0,  # ← Usa config global
                "is_active": True,
            },
        )
        if created:
            print(f"  ✓ {servicio_global.nombre} - Usa frecuencia global")

        # ==================== CONFIGURACIÓN GLOBAL ====================
        print("\n⚙️  Verificando configuración global...")
        config = ConfiguracionGlobal.get_config()
        print(
            f"  ✓ Margen de fidelización global: {config.margen_fidelizacion_dias} días"
        )
        print(f"  ✓ Descuento de fidelización: {config.descuento_fidelizacion_pct}%")

        # ==================== CLIENTES DE PRUEBA ====================
        print("\n👥 Creando clientes inactivos...")

        clientes_data = [
            {
                "email": "test_fid_cliente1@test.com",
                "username": "test_fid_cliente1",
                "first_name": "Laura",
                "last_name": "Martínez",
                "phone": "+54 11 8888-0001",
                "dias_inactivo": 45,  # Excede 30 días
                "servicio": servicio_30dias,
                "descripcion": "Inactivo 45 días - Excede frecuencia de 30 días",
            },
            {
                "email": "test_fid_cliente2@test.com",
                "username": "test_fid_cliente2",
                "first_name": "Roberto",
                "last_name": "Silva",
                "phone": "+54 11 8888-0002",
                "dias_inactivo": 70,  # Excede 60 días
                "servicio": servicio_60dias,
                "descripcion": "Inactivo 70 días - Excede frecuencia de 60 días",
            },
            {
                "email": "test_fid_cliente3@test.com",
                "username": "test_fid_cliente3",
                "first_name": "Ana",
                "last_name": "López",
                "phone": "+54 11 8888-0003",
                "dias_inactivo": 75,  # Excede config global (60)
                "servicio": servicio_global,
                "descripcion": "Inactivo 75 días - Excede configuración global",
            },
            {
                "email": "test_fid_cliente4@test.com",
                "username": "test_fid_cliente4",
                "first_name": "Diego",
                "last_name": "Fernández",
                "phone": "+54 11 8888-0004",
                "dias_inactivo": 90,  # Muy inactivo
                "servicio": servicio_30dias,
                "descripcion": "Inactivo 90 días - Cliente muy abandonado",
            },
        ]

        clientes_creados = []

        for data in clientes_data:
            # Crear usuario
            user, created = User.objects.get_or_create(
                email=data["email"],
                defaults={
                    "username": data["username"],
                    "first_name": data["first_name"],
                    "last_name": data["last_name"],
                    "role": "cliente",
                    "phone": data["phone"],
                    "is_active": True,
                },
            )
            if created:
                user.set_password("test123")
                user.save()

            # Crear perfil de cliente
            cliente, created = Cliente.objects.get_or_create(
                user=user,
                defaults={
                    "direccion": "Calle Prueba 123",
                    "is_vip": False,
                },
            )

            # Calcular fecha del último turno
            fecha_ultimo_turno = timezone.now() - timedelta(days=data["dias_inactivo"])
            fecha_ultimo_turno = fecha_ultimo_turno.replace(
                hour=15, minute=0, second=0, microsecond=0
            )

            # Crear turnos históricos (2-3 turnos completados)
            num_turnos = 3
            for i in range(num_turnos):
                dias_extra = i * 30  # Turnos separados por ~30 días
                fecha_turno = fecha_ultimo_turno - timedelta(days=dias_extra)

                turno, created = Turno.objects.get_or_create(
                    cliente=cliente,
                    empleado=empleado,
                    servicio=data["servicio"],
                    fecha_hora=fecha_turno,
                    defaults={
                        "sala": sala,
                        "estado": "completado",
                        "precio_final": data["servicio"].precio,
                        "notas_empleado": f"Turno histórico #{i+1} - {data['descripcion']}",
                    },
                )

            clientes_creados.append(
                {
                    "cliente": cliente,
                    "dias_inactivo": data["dias_inactivo"],
                    "servicio": data["servicio"],
                    "descripcion": data["descripcion"],
                }
            )

            print(f"\n  ✓ {cliente.nombre_completo} ({user.email})")
            print(f"    - Último turno: hace {data['dias_inactivo']} días")
            print(f"    - Servicio frecuente: {data['servicio'].nombre}")
            print(f"    - {data['descripcion']}")

        # ==================== RESUMEN ====================
        print("\n" + "=" * 70)
        print("✅ DATOS CREADOS EXITOSAMENTE")
        print("=" * 70)
        print(f"\n📊 {len(clientes_creados)} clientes inactivos creados")
        print("\n📋 INSTRUCCIONES PARA PROBAR:")
        print("\n1. Ve a: http://localhost:3000/dashboard/propietario/diagnostico")
        print("2. En 'Fidelización de Clientes':")
        print("   - Deja 'Días de inactividad' vacío para usar lógica automática")
        print("   - Mantén 'Enviar emails reales' desactivado (simulación)")
        print("3. Click en 'Gatillar Fidelización de Clientes'")
        print("\n🔍 RESULTADOS ESPERADOS:")
        for idx, info in enumerate(clientes_creados, 1):
            print(f"\n   Cliente {idx}: {info['cliente'].nombre_completo}")
            print(f"   ├─ Inactivo: {info['dias_inactivo']} días")
            print(f"   ├─ Servicio: {info['servicio'].nombre}")
            print(f"   └─ Debe aparecer: SÍ ✓")

        print("\n💡 PRUEBAS ADICIONALES:")
        print(
            "   • Ingresa '40' en días de inactividad → Solo aparecerán clientes con >40 días"
        )
        print(
            "   • Activa 'Enviar emails reales' → Se enviarán emails reales (¡cuidado!)"
        )
        print(f"   • Descuento aplicado: {config.descuento_fidelizacion_pct}%")
        print("=" * 70)

        return len(clientes_creados)


if __name__ == "__main__":
    try:
        total = crear_datos_fidelizacion()
        print(f"\n🎯 Total de clientes inactivos creados: {total}")
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback

        traceback.print_exc()
