from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.emails.services.email_service import EmailService


class EmailOfertaReasignacionTipoPagoTest(TestCase):
    def _build_payload(self, tipo_pago_cliente: str):
        cliente_user = SimpleNamespace(
            email="cliente@test.com",
            first_name="Laura",
            username="laura",
        )
        cliente = SimpleNamespace(user=cliente_user)

        empleado_user = SimpleNamespace(get_full_name=lambda: "Lucia Fernandez")
        empleado = SimpleNamespace(user=empleado_user)

        servicio = SimpleNamespace(
            nombre="Color completo + Brushing", precio=Decimal("1000.00")
        )

        turno_ofrecido = SimpleNamespace(
            cliente=cliente,
            fecha_hora=timezone.now() + timedelta(days=10),
            senia_pagada=(
                Decimal("1000.00")
                if tipo_pago_cliente == "PAGO_COMPLETO"
                else Decimal("500.00")
            ),
            resolver_tipo_pago=lambda: tipo_pago_cliente,
        )

        turno_cancelado = SimpleNamespace(
            servicio=servicio,
            empleado=empleado,
            fecha_hora=timezone.now() + timedelta(days=5),
        )

        log_reasignacion = SimpleNamespace(
            token="abc-token",
            expires_at=timezone.now() + timedelta(minutes=15),
            tipo_pago_cliente_ofertado=tipo_pago_cliente,
        )

        return turno_cancelado, turno_ofrecido, log_reasignacion

    @patch("apps.emails.services.email_service.send_mail")
    def test_mail_cliente_pago_completo_sin_promo(self, mock_send_mail):
        turno_cancelado, turno_ofrecido, log_reasignacion = self._build_payload(
            "PAGO_COMPLETO"
        )

        ok = EmailService.enviar_email_oferta_reasignacion(
            turno_cancelado=turno_cancelado,
            turno_ofrecido=turno_ofrecido,
            log_reasignacion=log_reasignacion,
            monto_final=Decimal("0.00"),
            monto_descuento=Decimal("0.00"),
            senia_pagada=Decimal("1000.00"),
        )

        self.assertTrue(ok)
        self.assertTrue(mock_send_mail.called)
        kwargs = mock_send_mail.call_args.kwargs
        self.assertEqual(kwargs["subject"], "Reacomodo de turno disponible")
        self.assertIn(
            "no incluye descuento promocional adicional",
            kwargs["html_message"],
        )
        self.assertIn(
            "Ver detalles y confirmar reacomodo",
            kwargs["html_message"],
        )
        self.assertNotIn("Descuento especial:", kwargs["html_message"])

    @patch("apps.emails.services.email_service.send_mail")
    def test_mail_cliente_con_senia_muestra_promo(self, mock_send_mail):
        turno_cancelado, turno_ofrecido, log_reasignacion = self._build_payload("SENIA")

        ok = EmailService.enviar_email_oferta_reasignacion(
            turno_cancelado=turno_cancelado,
            turno_ofrecido=turno_ofrecido,
            log_reasignacion=log_reasignacion,
            monto_final=Decimal("0.00"),
            monto_descuento=Decimal("1000.00"),
            senia_pagada=Decimal("500.00"),
        )

        self.assertTrue(ok)
        self.assertTrue(mock_send_mail.called)
        kwargs = mock_send_mail.call_args.kwargs
        self.assertEqual(kwargs["subject"], "Tenemos un turno antes para ti")
        self.assertIn("Descuento especial:", kwargs["html_message"])
        self.assertIn("Ver detalles y confirmar", kwargs["html_message"])
