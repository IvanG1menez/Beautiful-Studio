from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from apps.authentication.models import ConfiguracionGlobal
from apps.servicios.models import Servicio
from apps.turnos.models import Turno
from apps.turnos.services.reasignacion_service import _calcular_descuento_para_candidato


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
