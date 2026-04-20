from datetime import timedelta
from decimal import Decimal
from datetime import date, time

from django.test import TestCase
from django.utils import timezone

from apps.authentication.models import ConfiguracionGlobal
from apps.clientes.models import Billetera, Cliente
from apps.empleados.models import Empleado
from apps.servicios.models import Servicio
from apps.servicios.models import CategoriaServicio, Sala
from apps.turnos.models import Turno
from apps.turnos.services.cancelacion_service import cancelar_turno_para_cliente
from apps.turnos.services.reasignacion_service import _calcular_descuento_para_candidato
from apps.users.models import User


class ReasignacionReglasPagoTest(TestCase):
    def setUp(self):
        config = ConfiguracionGlobal.get_config()
        config.min_horas_cancelacion_credito = 24
        config.save(update_fields=["min_horas_cancelacion_credito"])

        self.servicio = Servicio(
            bono_reacomodamiento_senia=Decimal("1000.00"),
            bono_reacomodamiento_pago_completo=Decimal("2000.00"),
            horas_minimas_credito_cancelacion=24,
        )

    def test_fuera_de_termino_cliente_con_senia_recibe_bono(self):
        turno_cancelado = Turno(
            servicio=self.servicio,
            fecha_hora=timezone.now() + timedelta(hours=2),
        )
        turno_candidato = Turno(tipo_pago="SENIA")

        descuento, regla, tipo_pago = _calcular_descuento_para_candidato(
            turno_cancelado, turno_candidato
        )

        self.assertEqual(descuento, Decimal("1000.00"))
        self.assertEqual(regla, "FUERA_DE_TERMINO_BONO_SENIA")
        self.assertEqual(tipo_pago, "SENIA")

    def test_fuera_de_termino_cliente_con_pago_completo_no_recibe_promo(self):
        turno_cancelado = Turno(
            servicio=self.servicio,
            fecha_hora=timezone.now() + timedelta(hours=2),
        )
        turno_candidato = Turno(tipo_pago="PAGO_COMPLETO")

        descuento, regla, tipo_pago = _calcular_descuento_para_candidato(
            turno_cancelado, turno_candidato
        )

        self.assertEqual(descuento, Decimal("0.00"))
        self.assertEqual(regla, "FUERA_DE_TERMINO_PAGO_COMPLETO_SIN_PROMO")
        self.assertEqual(tipo_pago, "PAGO_COMPLETO")

    def test_en_termino_no_aplica_descuento_sin_importar_tipo_pago(self):
        turno_cancelado = Turno(
            servicio=self.servicio,
            fecha_hora=timezone.now() + timedelta(hours=30),
        )
        turno_candidato = Turno(tipo_pago="SENIA")

        descuento, regla, tipo_pago = _calcular_descuento_para_candidato(
            turno_cancelado, turno_candidato
        )

        self.assertEqual(descuento, Decimal("0.00"))
        self.assertEqual(regla, "CANCELACION_EN_TERMINO_SIN_DESCUENTO")
        self.assertEqual(tipo_pago, "SIN_DESCUENTO")


class CancelacionCreditoServiceTest(TestCase):
    def setUp(self):
        config = ConfiguracionGlobal.get_config()
        config.min_horas_cancelacion_credito = 24
        config.save(update_fields=["min_horas_cancelacion_credito"])

        self.sala = Sala.objects.create(nombre="Sala Test", capacidad_simultanea=2)
        self.categoria = CategoriaServicio.objects.create(
            nombre="Categoria Test",
            sala=self.sala,
        )
        self.servicio = Servicio.objects.create(
            nombre="Servicio Test",
            categoria=self.categoria,
            precio=Decimal("20000.00"),
            duracion_minutos=60,
            horas_minimas_credito_cancelacion=24,
        )

        self.user_cliente = User.objects.create_user(
            email="cliente.credito@test.com",
            password="password1.2.3",
            username="cliente_credito",
            first_name="Cliente",
            last_name="Credito",
            role="cliente",
            phone="+54 9 11 2222-3333",
        )
        self.cliente = Cliente.objects.create(user=self.user_cliente)

        self.user_empleado = User.objects.create_user(
            email="profesional.credito@test.com",
            password="password1.2.3",
            username="profesional_credito",
            first_name="Pro",
            last_name="Credito",
            role="profesional",
        )
        self.empleado = Empleado.objects.create(
            user=self.user_empleado,
            fecha_ingreso=date.today(),
            horario_entrada=time(9, 0),
            horario_salida=time(18, 0),
            dias_trabajo="L,M,M,J,V",
            comision_porcentaje=Decimal("10.00"),
        )

    def test_cancelacion_en_termino_aplica_credito_en_billetera(self):
        turno = Turno.objects.create(
            cliente=self.cliente,
            empleado=self.empleado,
            servicio=self.servicio,
            fecha_hora=timezone.now() + timedelta(hours=30),
            estado="pendiente",
            tipo_pago="SENIA",
            senia_pagada=Decimal("5000.00"),
            precio_final=Decimal("20000.00"),
        )

        result = cancelar_turno_para_cliente(
            turno=turno,
            usuario=self.user_cliente,
            motivo="Cambio de agenda",
        )

        turno.refresh_from_db()
        billetera = Billetera.objects.get(cliente=self.cliente)
        movimiento = billetera.movimientos.first()

        self.assertTrue(result.credito_aplicado)
        self.assertEqual(result.monto_credito, 5000.0)
        self.assertEqual(turno.estado, "cancelado")
        self.assertEqual(billetera.saldo, Decimal("5000.00"))
        self.assertIsNotNone(movimiento)
        self.assertEqual(movimiento.turno_id, turno.id)

    def test_cancelacion_fuera_de_rango_no_aplica_credito(self):
        turno = Turno.objects.create(
            cliente=self.cliente,
            empleado=self.empleado,
            servicio=self.servicio,
            fecha_hora=timezone.now() + timedelta(hours=3),
            estado="pendiente",
            tipo_pago="SENIA",
            senia_pagada=Decimal("5000.00"),
            precio_final=Decimal("20000.00"),
        )

        result = cancelar_turno_para_cliente(
            turno=turno,
            usuario=self.user_cliente,
            motivo="Imprevisto de ultimo momento",
        )

        turno.refresh_from_db()

        self.assertFalse(result.credito_aplicado)
        self.assertEqual(result.monto_credito, 0.0)
        self.assertEqual(turno.estado, "cancelado")
        self.assertFalse(Billetera.objects.filter(cliente=self.cliente).exists())
