"""
Script para probar manualmente el flujo de reasignación con datos reales

Prerrequisitos:
- Tener al menos 2 clientes creados en la BD
- Tener un servicio con permite_reacomodamiento=True
- Tener un empleado disponible

Este script:
1. Crea 2 turnos del mismo servicio para diferentes clientes
2. Cancela el primero (más temprano)
3. Verifica que se envía oferta al segundo cliente
4. Muestra el link para confirmar la oferta

Uso:
    python Scripts/test_reasignacion_manual.py
"""

import os
import sys
import django
from decimal import Decimal
from datetime import datetime, timedelta

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.utils import timezone
from apps.users.models import User
from apps.clientes.models import Cliente
from apps.empleados.models import Empleado
from apps.servicios.models import Servicio
from apps.turnos.models import Turno, LogReasignacion


def test_reasignacion_manual():
    print("=" * 70)
    print("🧪 TEST DE REASIGNACIÓN CON DATOS REALES")
    print("=" * 70)

    # ==================== VERIFICAR DATOS EXISTENTES ====================
    print("\n📋 Verificando datos existentes...")

    # Buscar servicio con reacomodamiento habilitado
    servicio = Servicio.objects.filter(permite_reacomodamiento=True).first()
    if not servicio:
        print("\n❌ ERROR: No hay servicios con permite_reacomodamiento=True")
        print(
            "   Por favor, edita un servicio y marca el campo permite_reacomodamiento como True"
        )
        return

    print(f"\n✅ Servicio encontrado: {servicio.nombre}")
    print(f"   - Precio: ${servicio.precio}")
    print(f"   - Descuento por reasignación: ${servicio.descuento_reasignacion or 0}")
    print(f"   - Permite reacomodamiento: {servicio.permite_reacomodamiento}")

    # Buscar empleado
    empleado = Empleado.objects.filter(user__is_active=True).first()
    if not empleado:
        print("\n❌ ERROR: No hay empleados activos")
        return

    print(f"\n✅ Empleado encontrado: {empleado.nombre_completo}")

    # Buscar 2 clientes
    clientes = Cliente.objects.filter(user__is_active=True)[:2]
    if clientes.count() < 2:
        print(
            f"\n❌ ERROR: Se necesitan al menos 2 clientes activos (encontrados: {clientes.count()})"
        )
        print(
            "   Por favor, crea más clientes desde el dashboard o con el script poblar_usuarios_base.py"
        )
        return

    cliente_a = clientes[0]
    cliente_b = clientes[1]

    print(f"\n✅ Clientes encontrados:")
    print(f"   - Cliente A: {cliente_a.nombre_completo} ({cliente_a.user.email})")
    print(f"   - Cliente B: {cliente_b.nombre_completo} ({cliente_b.user.email})")

    # ==================== CREAR TURNOS ====================
    print("\n📅 Creando turnos de prueba...")

    # Buscar un horario disponible para el empleado
    # Nota: La constraint única en la BD es sobre (empleado_id, fecha_hora),
    # no sobre el estado. Por lo tanto, debemos verificar TODOS los turnos,
    # incluidos los cancelados y completados.
    fecha_base = timezone.now().replace(
        hour=14, minute=0, second=0, microsecond=0
    ) + timedelta(days=1)

    # Buscar un slot libre (cualquier turno en esa fecha/hora genera constraint error)
    fecha_turno1 = fecha_base
    intentos = 0
    while (
        Turno.objects.filter(empleado=empleado, fecha_hora=fecha_turno1).exists()
        and intentos < 30
    ):
        fecha_turno1 += timedelta(days=1)
        intentos += 1

    if intentos >= 30:
        print("\n❌ ERROR: No se pudo encontrar un horario disponible para el empleado")
        print("   Por favor, libera algunos horarios o usa otro empleado")
        return

    # Turno 1: Cliente A, más temprano (será cancelado)
    turno1 = Turno.objects.create(
        cliente=cliente_a,
        servicio=servicio,
        empleado=empleado,
        fecha_hora=fecha_turno1,
        estado="confirmado",
        senia_pagada=Decimal("1000.00"),
        precio_final=servicio.precio,
        notas_cliente="Turno de prueba - Cliente A",
    )

    print(f"\n✅ Turno 1 creado:")
    print(f"   - ID: {turno1.id}")
    print(f"   - Cliente: {turno1.cliente.nombre_completo}")
    print(f"   - Fecha: {turno1.fecha_hora.strftime('%d/%m/%Y %H:%M')}")
    print(f"   - Estado: {turno1.estado}")
    print(f"   - Seña: ${turno1.senia_pagada}")

    # Turno 2: Cliente B, más tarde (recibirá oferta)
    # Buscar otro slot libre después del turno 1
    fecha_turno2 = fecha_turno1 + timedelta(days=5)
    intentos = 0
    while (
        Turno.objects.filter(empleado=empleado, fecha_hora=fecha_turno2).exists()
        and intentos < 30
    ):
        fecha_turno2 += timedelta(days=1)
        intentos += 1

    if intentos >= 30:
        print("\n❌ ERROR: No se pudo encontrar un horario disponible para el turno 2")
        print("   Limpiando turno 1...")
        turno1.delete()
        return

    turno2 = Turno.objects.create(
        cliente=cliente_b,
        servicio=servicio,
        empleado=empleado,
        fecha_hora=fecha_turno2,
        estado="confirmado",
        senia_pagada=Decimal("1000.00"),
        precio_final=servicio.precio,
        notas_cliente="Turno de prueba - Cliente B",
    )

    print(f"\n✅ Turno 2 creado:")
    print(f"   - ID: {turno2.id}")
    print(f"   - Cliente: {turno2.cliente.nombre_completo}")
    print(f"   - Fecha: {turno2.fecha_hora.strftime('%d/%m/%Y %H:%M')}")
    print(f"   - Estado: {turno2.estado}")
    print(f"   - Seña: ${turno2.senia_pagada}")

    # ==================== CANCELAR TURNO 1 ====================
    print("\n🚫 Cancelando Turno 1...")

    turno1.estado = "cancelado"
    turno1.save()

    # Trigger manual del proceso de reasignación
    from apps.turnos.services.reasignacion_service import iniciar_reasignacion_turno

    resultado = iniciar_reasignacion_turno(turno1.id)

    print(f"\n📨 Resultado de reasignación:")
    print(f"   - Status: {resultado.get('status')}")

    if resultado.get("status") == "oferta_enviada":
        log_id = resultado.get("log_id")
        log = LogReasignacion.objects.get(id=log_id)

        print(f"\n✅ ¡Oferta enviada exitosamente!")
        print(f"   - Log ID: {log.id}")
        print(f"   - Token: {log.token}")
        print(f"   - Cliente notificado: {log.cliente_notificado.nombre_completo}")
        print(f"   - Expira: {log.expires_at.strftime('%d/%m/%Y %H:%M')}")
        print(f"   - Descuento: ${log.monto_descuento}")

        # Calcular monto final
        precio_total = Decimal(turno1.servicio.precio)
        descuento = Decimal(log.monto_descuento)
        senia = Decimal(turno2.senia_pagada)
        monto_final = max(Decimal("0.00"), (precio_total - descuento) - senia)

        print(f"\n💰 Desglose de precios:")
        print(f"   - Precio servicio: ${precio_total}")
        print(f"   - Descuento: -${descuento}")
        print(f"   - Seña acreditada: -${senia}")
        print(f"   - Monto final: ${monto_final}")

        # ==================== LINK DE CONFIRMACIÓN ====================
        print("\n" + "=" * 70)
        print("🔗 LINK DE CONFIRMACIÓN")
        print("=" * 70)
        print(f"\nAbre este link en tu navegador:")
        print(f"\n👉 http://localhost:3000/reacomodamiento/confirmar?token={log.token}")
        print("\n" + "=" * 70)

        print("\n📧 Revisa el email enviado:")
        print(f"   - Destinatario: {cliente_b.user.email}")
        print(f"   - Verifica en Mailtrap o tu bandeja de entrada")

        print("\n💡 Próximos pasos:")
        print("   1. Abre el link en tu navegador")
        print("   2. Verifica que muestra:")
        print("      - Turno original (Cliente B)")
        print("      - Turno nuevo (Cliente A, adelantado)")
        print("      - Desglose de precios con descuento")
        print("   3. Prueba los botones:")
        print("      - 'Aceptar adelanto'")
        print("      - 'Mantener turno original'")
        print("   4. Verifica el resultado en la BD")

    else:
        print(f"\n⚠️ No se pudo enviar oferta")
        print(f"   Motivo: {resultado.get('status')}")

    # ==================== INFORMACIÓN DE CLEANUP ====================
    print("\n\n🧹 Para limpiar estos datos después:")
    print(f"   - Turno 1 ID: {turno1.id}")
    print(f"   - Turno 2 ID: {turno2.id}")
    print(f"\n   DELETE FROM turnos_turno WHERE id IN ({turno1.id}, {turno2.id});")

    print("\n" + "=" * 70)


if __name__ == "__main__":
    try:
        test_reasignacion_manual()
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback

        traceback.print_exc()
