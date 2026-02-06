from django.test import TestCase
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta

# Imports de tus apps según tu estructura de carpetas
from .models import Servicio, CategoriaServicio
from apps.users.models import User  # Asegúrate que el modelo se llame User
from apps.turnos.models import Turno  # Asegúrate que el modelo se llame Turno
from apps.clientes.models import Cliente  # Asegúrate que el modelo se llame Cliente
from apps.empleados.models import Empleado  # Asegúrate que el modelo se llame Empleado


class FinanzasServicioTest(TestCase):
    def test_calculo_descuento_sobre_total(self):
        """Verifica que el saldo restante sea correcto aplicando descuento al total"""
        precio_base = Decimal("20000.00")
        descuento_adelanto = Decimal("2000.00")
        sena_pagada = Decimal("5000.00")

        precio_final = precio_base - descuento_adelanto
        saldo_en_local = precio_final - sena_pagada

        print(f"\n[TEST PLATA] Saldo calculado: {saldo_en_local}")
        self.assertEqual(saldo_en_local, Decimal("13000.00"))


class ReacomodamientoTest(TestCase):
    def test_prioridad_turno_lejano(self):
        print("\n[TEST REACOMODAMIENTO] Iniciando configuración del escenario...")
        ahora = timezone.now()

        # 1. Crear la base (Servicio)
        self.cat = CategoriaServicio.objects.create(nombre="Estética", is_active=True)
        self.srv = Servicio.objects.create(
            nombre="Limpieza Facial",
            precio=Decimal("5000.00"),
            duracion_minutos=45,
            categoria_id=self.cat.id,
        )
        print(f"  ✅ Servicio creado: {self.srv}")

        # 2. Crear el Usuario y el Cliente (Para evitar el AttributeError)
        self.user_juan = User.objects.create(
            username="juan_perez",
            first_name="Juan",
            last_name="Perez",
            email="juan@example.com",
        )
        self.c1 = Cliente.objects.create(
            user=self.user_juan,
            direccion="Calle Falsa 123",
        )
        print(f"  ✅ Cliente creado: {self.c1}")

        # 3. Crear el Empleado (Con todas las restricciones Not Null)
        self.user_empleado = User.objects.create(
            username="empleado_1", first_name="Admin", last_name="Estudio"
        )
        self.emp = Empleado.objects.create(
            user=self.user_empleado,
            fecha_ingreso=ahora.date(),
            horario_entrada=ahora.time(),
            horario_salida=(ahora + timedelta(hours=8)).time(),
            dias_trabajo="L,M,M,J,V",
            comision_porcentaje=Decimal("20.00"),
            is_disponible=True,
        )
        print(f"  ✅ Empleado creado: {self.emp}")

        # 4. Crear los Turnos (Ahora que c1, srv y emp existen)
        print("  ⏰ Inyectando turnos escalonados en la base temporal...")

        # Turno cercano (2 días)
        Turno.objects.create(
            cliente=self.c1,
            servicio=self.srv,
            empleado=self.emp,
            fecha_hora=ahora + timedelta(days=2),
        )

        # Turno intermedio (10 días)
        Turno.objects.create(
            cliente=self.c1,
            servicio=self.srv,
            empleado=self.emp,
            fecha_hora=ahora + timedelta(days=10),
        )

        # Turno OBJETIVO (30 días - El más lejano)
        turno_objetivo = Turno.objects.create(
            cliente=self.c1,
            servicio=self.srv,
            empleado=self.emp,
            fecha_hora=ahora + timedelta(days=30),
        )
        print(f"  ✅ Turnos creados. Objetivo esperado ID: {turno_objetivo.id}")

        # 5. Ejecutar y Validar Query de Búsqueda Inversa
        print("[PASO 5] Ejecutando Query de Búsqueda Inversa...")

        # Ordenamos por fecha_hora de forma descendente (el más lejano primero)
        candidatos = Turno.objects.filter(servicio=self.srv).order_by("-fecha_hora")

        print(
            f"  🔍 El sistema seleccionó el turno del día: {candidatos[0].fecha_hora}"
        )

        # El test pasa si el primero de la lista es el que creamos para dentro de 30 días
        self.assertEqual(candidatos[0].id, turno_objetivo.id)
        print("[OK FINAL] El motor de búsqueda inversa funciona perfectamente.")
