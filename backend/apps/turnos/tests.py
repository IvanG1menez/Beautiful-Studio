from datetime import timedelta
from decimal import Decimal
from datetime import date, time

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.authentication.models import AuditoriaAcciones, ConfiguracionGlobal
from apps.clientes.models import Billetera, Cliente
from apps.emails.models import Notificacion
from apps.empleados.models import Empleado, EmpleadoServicio
from apps.servicios.models import Servicio
from apps.servicios.models import CategoriaServicio, Sala
from apps.turnos.models import LogReasignacion, SolicitudReprogramacionFlexible, Turno
from apps.turnos.services.cancelacion_service import cancelar_turno_para_cliente
from apps.turnos.services.reasignacion_service import _calcular_descuento_para_candidato
from apps.users.models import User


class ReasignacionReglasPagoTest(TestCase):
    def setUp(self):
        config = ConfiguracionGlobal.get_config()
        config.min_horas_cancelacion_credito = 24
        config.horas_vencimiento_solicitud_reprogramacion = 48
        config.save(update_fields=["min_horas_cancelacion_credito", "horas_vencimiento_solicitud_reprogramacion"])

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

        with self.assertRaises(ValueError) as exc:
            cancelar_turno_para_cliente(
                turno=turno,
                usuario=self.user_cliente,
                motivo="Imprevisto de ultimo momento",
            )

        turno.refresh_from_db()

        self.assertIn("no puede ser cancelado", str(exc.exception).lower())
        self.assertEqual(turno.estado, "pendiente")
        self.assertFalse(Billetera.objects.filter(cliente=self.cliente).exists())


class ReprogramacionTurnoAPITest(TestCase):
    def setUp(self):
        self.client_api = APIClient()
        config = ConfiguracionGlobal.get_config()
        config.min_horas_cancelacion_credito = 24
        config.save(update_fields=["min_horas_cancelacion_credito"])

        self.sala = Sala.objects.create(nombre="Sala Reprog", capacidad_simultanea=2)
        self.categoria = CategoriaServicio.objects.create(
            nombre="Categoria Reprog",
            sala=self.sala,
        )
        self.servicio = Servicio.objects.create(
            nombre="Servicio Reprog",
            categoria=self.categoria,
            precio=Decimal("12000.00"),
            duracion_minutos=60,
            horas_minimas_credito_cancelacion=24,
        )

        self.user_cliente = User.objects.create_user(
            email="cliente.reprog@test.com",
            password="password1.2.3",
            username="cliente_reprog",
            first_name="Cliente",
            last_name="Reprog",
            role="cliente",
        )
        self.cliente = Cliente.objects.create(user=self.user_cliente)

        self.user_otro_cliente = User.objects.create_user(
            email="cliente.ajeno@test.com",
            password="password1.2.3",
            username="cliente_ajeno",
            first_name="Cliente",
            last_name="Ajeno",
            role="cliente",
        )
        self.otro_cliente = Cliente.objects.create(user=self.user_otro_cliente)

        self.user_profesional = User.objects.create_user(
            email="profesional.reprog@test.com",
            password="password1.2.3",
            username="profesional_reprog",
            first_name="Pro",
            last_name="Reprog",
            role="profesional",
        )
        self.profesional = Empleado.objects.create(
            user=self.user_profesional,
            fecha_ingreso=date.today(),
            horario_entrada=time(0, 0),
            horario_salida=time(23, 59),
            dias_trabajo="L,M,Mi,J,V,S",
            comision_porcentaje=Decimal("10.00"),
        )

        self.user_profesional_2 = User.objects.create_user(
            email="profesional2.reprog@test.com",
            password="password1.2.3",
            username="profesional2_reprog",
            first_name="Pro",
            last_name="Alternativo",
            role="profesional",
        )
        self.profesional_2 = Empleado.objects.create(
            user=self.user_profesional_2,
            fecha_ingreso=date.today(),
            horario_entrada=time(0, 0),
            horario_salida=time(23, 59),
            dias_trabajo="L,M,Mi,J,V,S",
            comision_porcentaje=Decimal("10.00"),
        )
        EmpleadoServicio.objects.create(
            empleado=self.profesional_2,
            servicio=self.servicio,
            nivel_experiencia=3,
        )

        fecha_turno = timezone.now() + timedelta(days=3)
        if fecha_turno.weekday() == 6:  # Domingo
            fecha_turno += timedelta(days=1)
        fecha_turno = fecha_turno.replace(hour=10, minute=0, second=0, microsecond=0)

        self.turno = Turno.objects.create(
            cliente=self.cliente,
            empleado=self.profesional,
            servicio=self.servicio,
            fecha_hora=fecha_turno,
            estado="confirmado",
            senia_pagada=Decimal("3000.00"),
            tipo_pago="SENIA",
            precio_final=Decimal("12000.00"),
        )

    def test_cliente_duenio_puede_reprogramar_turno_confirmado(self):
        self.client_api.force_authenticate(self.user_cliente)
        fecha_objetivo = self.turno.fecha_hora + timedelta(days=1, hours=1)
        while fecha_objetivo.weekday() == 6:  # Evitar domingo
            fecha_objetivo += timedelta(days=1)
        nueva_fecha = fecha_objetivo.isoformat()

        response = self.client_api.post(
            f"/api/turnos/{self.turno.id}/reprogramar/",
            {
                "nueva_fecha_hora": nueva_fecha,
                "motivo": "Cambio de agenda personal",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)

        self.turno.refresh_from_db()
        self.assertEqual(self.turno.estado, "pendiente")
        self.assertEqual(self.turno.senia_pagada, Decimal("0.00"))
        self.assertEqual(self.turno.tipo_pago, "SIN_PAGO")
        self.assertEqual(self.turno.precio_final, Decimal("12000.00"))

    def test_cliente_puede_reprogramar_con_otro_profesional(self):
        self.client_api.force_authenticate(self.user_cliente)
        nueva_fecha = (timezone.now() + timedelta(hours=45)).isoformat()

        response = self.client_api.post(
            f"/api/turnos/{self.turno.id}/reprogramar/",
            {
                "nueva_fecha_hora": nueva_fecha,
                "nuevo_empleado_id": self.profesional_2.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.turno.refresh_from_db()
        self.assertEqual(self.turno.empleado_id, self.profesional_2.id)
        self.assertEqual(self.turno.estado, "pendiente")
        self.assertEqual(self.turno.senia_pagada, Decimal("0.00"))

    def test_cliente_ajeno_no_puede_reprogramar(self):
        self.client_api.force_authenticate(self.user_otro_cliente)
        nueva_fecha = (timezone.now() + timedelta(hours=40)).isoformat()

        response = self.client_api.post(
            f"/api/turnos/{self.turno.id}/reprogramar/",
            {"nueva_fecha_hora": nueva_fecha},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_no_permite_reprogramar_con_menos_de_24_horas(self):
        self.client_api.force_authenticate(self.user_cliente)

        self.turno.fecha_hora = timezone.now() + timedelta(hours=8)
        self.turno.save(update_fields=["fecha_hora"])

        response = self.client_api.post(
            f"/api/turnos/{self.turno.id}/reprogramar/",
            {"nueva_fecha_hora": (timezone.now() + timedelta(hours=30)).isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("24 horas", response.data.get("error", ""))
        self.assertIn("El monto del Servicio Reprog", response.data.get("error", ""))

    def test_cliente_reprograma_fuera_de_24h_con_alerta_y_auditoria(self):
        self.client_api.force_authenticate(self.user_cliente)

        self.turno.fecha_hora = timezone.now() + timedelta(hours=8)
        self.turno.save(update_fields=["fecha_hora"])

        nueva_fecha = timezone.now() + timedelta(hours=30)
        while nueva_fecha.weekday() == 6:
            nueva_fecha += timedelta(days=1)

        response = self.client_api.post(
            f"/api/turnos/{self.turno.id}/reprogramar/",
            {
                "nueva_fecha_hora": nueva_fecha.isoformat(),
                "aceptar_penalidad_fuera_rango": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["penalidad_aplicada"])
        self.assertEqual(
            response.data["estado_pago_reprogramacion"],
            "SENIA_PENDIENTE_LOCAL",
        )
        self.assertIn("El monto del Servicio Reprog", response.data["mensaje_penalidad"])

        self.turno.refresh_from_db()
        self.assertEqual(self.turno.estado, "pendiente")
        self.assertEqual(self.turno.senia_pagada, Decimal("0.00"))

        auditoria = AuditoriaAcciones.objects.filter(
            modelo_afectado="Turno",
            objeto_id=self.turno.id,
            detalles__tipo_movimiento="reprogramacion_turno",
        ).first()
        self.assertIsNotNone(auditoria)
        self.assertTrue(auditoria.detalles["penalidad_aplicada"])

    def test_profesional_asigna_solicitud_flexible_fuera_de_24h_sin_bloqueo(self):
        self.client_api.force_authenticate(self.user_profesional)

        self.turno.fecha_hora = timezone.now() + timedelta(hours=8)
        self.turno.save(update_fields=["fecha_hora"])
        solicitud = SolicitudReprogramacionFlexible.objects.create(
            turno=self.turno,
            cliente=self.cliente,
            motivo="Necesito reprogramar",
        )

        nueva_fecha = timezone.now() + timedelta(hours=30)
        while nueva_fecha.weekday() == 6:
            nueva_fecha += timedelta(days=1)

        response = self.client_api.post(
            f"/api/turnos/solicitudes-flexibles/{solicitud.id}/asignar/",
            {
                "fecha_hora": nueva_fecha.isoformat(),
                "observaciones": "Acomodado segun agenda profesional",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["penalidad_aplicada"])

        self.turno.refresh_from_db()
        solicitud.refresh_from_db()
        self.assertEqual(self.turno.estado, "pendiente")
        self.assertEqual(self.turno.senia_pagada, Decimal("0.00"))
        self.assertEqual(solicitud.estado, "atendida")
        self.assertTrue(solicitud.requiere_senia_nueva)

        self.assertTrue(
            AuditoriaAcciones.objects.filter(
                modelo_afectado="Turno",
                objeto_id=self.turno.id,
                detalles__tipo_movimiento="solicitud_reprogramacion_flexible_atendida",
            ).exists()
        )

    def test_solicitud_flexible_deja_turno_pendiente_manual(self):
        self.client_api.force_authenticate(self.user_cliente)

        antes = timezone.now()
        response = self.client_api.post(
            f"/api/turnos/{self.turno.id}/solicitar-reprogramacion-flexible/",
            {"motivo": "No encuentro horario disponible"},
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.turno.refresh_from_db()
        self.assertEqual(self.turno.estado, "pendiente_manual")
        solicitud = SolicitudReprogramacionFlexible.objects.get(turno=self.turno)
        self.assertIsNotNone(solicitud.expires_at)
        self.assertGreaterEqual(solicitud.expires_at, antes + timedelta(hours=47, minutes=59))

    def test_solicitud_flexible_usa_vencimiento_configurable(self):
        config = ConfiguracionGlobal.get_config()
        config.horas_vencimiento_solicitud_reprogramacion = 72
        config.save(update_fields=["horas_vencimiento_solicitud_reprogramacion"])
        self.client_api.force_authenticate(self.user_cliente)

        antes = timezone.now()
        response = self.client_api.post(
            f"/api/turnos/{self.turno.id}/solicitar-reprogramacion-flexible/",
            {"motivo": "Prefiero otro horario"},
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        solicitud = SolicitudReprogramacionFlexible.objects.get(turno=self.turno)
        self.assertGreaterEqual(solicitud.expires_at, antes + timedelta(hours=71, minutes=59))
        self.assertFalse(response.data["solicitud"]["esta_vencida"])

    def test_profesional_no_puede_rechazar_solicitud_flexible(self):
        self.client_api.force_authenticate(self.user_profesional)
        solicitud = SolicitudReprogramacionFlexible.objects.create(
            turno=self.turno,
            cliente=self.cliente,
            motivo="Revisar manualmente",
            expires_at=timezone.now() + timedelta(hours=48),
        )

        response = self.client_api.post(
            f"/api/turnos/solicitudes-flexibles/{solicitud.id}/rechazar/",
            {"observaciones": "No puedo"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        solicitud.refresh_from_db()
        self.assertEqual(solicitud.estado, "pendiente")

    def test_solicitud_flexible_fuera_de_termino_marca_senia_perdida(self):
        self.client_api.force_authenticate(self.user_cliente)
        self.turno.fecha_hora = timezone.now() + timedelta(hours=8)
        self.turno.save(update_fields=["fecha_hora"])

        response = self.client_api.post(
            f"/api/turnos/{self.turno.id}/solicitar-reprogramacion-flexible/",
            {"motivo": "No puedo asistir"},
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.turno.refresh_from_db()
        solicitud = SolicitudReprogramacionFlexible.objects.get(turno=self.turno)
        self.assertTrue(solicitud.requiere_senia_nueva)
        self.assertEqual(self.turno.estado, "pendiente_manual")
        self.assertEqual(self.turno.senia_pagada, Decimal("0.00"))
        self.assertEqual(self.turno.tipo_pago, "SIN_PAGO")

    def test_cliente_no_puede_reprogramar_mismo_servicio_dos_veces_en_mes(self):
        self.client_api.force_authenticate(self.user_cliente)

        response_1 = self.client_api.post(
            f"/api/turnos/{self.turno.id}/solicitar-reprogramacion-flexible/",
            {"motivo": "Primer cambio"},
            format="json",
        )
        self.assertEqual(response_1.status_code, 201, response_1.data)

        otro_turno = Turno.objects.create(
            cliente=self.cliente,
            empleado=self.profesional,
            servicio=self.servicio,
            fecha_hora=timezone.now() + timedelta(days=6),
            estado="confirmado",
            senia_pagada=Decimal("3000.00"),
            tipo_pago="SENIA",
            precio_final=Decimal("12000.00"),
        )

        response_2 = self.client_api.post(
            f"/api/turnos/{otro_turno.id}/solicitar-reprogramacion-flexible/",
            {"motivo": "Segundo cambio mismo servicio"},
            format="json",
        )

        self.assertEqual(response_2.status_code, 400)
        self.assertIn("una vez este mes", response_2.data.get("error", ""))

    def test_disponibilidad_acepta_profesional_null_y_devuelve_slots_globales(self):
        self.client_api.force_authenticate(self.user_cliente)
        fecha = (timezone.now() + timedelta(days=2)).date()
        while fecha.weekday() == 6:
            fecha += timedelta(days=1)

        response = self.client_api.get(
            "/api/turnos/disponibilidad/",
            {
                "profesional_id": "null",
                "servicio": self.servicio.id,
                "fecha": fecha.isoformat(),
            },
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("slots", response.data)
        self.assertTrue(response.data["disponible"])
        self.assertGreater(len(response.data["slots"]), 0)

    def test_profesional_recibe_conflicto_y_puede_sobreturnar(self):
        self.client_api.force_authenticate(self.user_profesional)
        fecha_conflicto = timezone.now() + timedelta(days=4)
        while fecha_conflicto.weekday() == 6:
            fecha_conflicto += timedelta(days=1)
        fecha_conflicto = fecha_conflicto.replace(hour=11, minute=0, second=0, microsecond=0)

        Turno.objects.create(
            cliente=self.otro_cliente,
            empleado=self.profesional,
            servicio=self.servicio,
            fecha_hora=fecha_conflicto,
            estado="confirmado",
            precio_final=Decimal("12000.00"),
        )
        solicitud = SolicitudReprogramacionFlexible.objects.create(
            turno=self.turno,
            cliente=self.cliente,
            motivo="Revisar manualmente",
        )

        response_conflicto = self.client_api.post(
            f"/api/turnos/solicitudes-flexibles/{solicitud.id}/asignar/",
            {"fecha_hora": fecha_conflicto.isoformat()},
            format="json",
        )

        self.assertEqual(response_conflicto.status_code, 409)
        self.assertTrue(response_conflicto.data["requiere_confirmacion_sobreturno"])

        response_ok = self.client_api.post(
            f"/api/turnos/solicitudes-flexibles/{solicitud.id}/asignar/",
            {
                "fecha_hora": fecha_conflicto.isoformat(),
                "permitir_sobreturno": True,
            },
            format="json",
        )

        self.assertEqual(response_ok.status_code, 200, response_ok.data)
        self.assertTrue(
            Notificacion.objects.filter(
                usuario=self.user_cliente,
                titulo="Tu profesional ya te asignó un nuevo horario",
            ).exists()
        )

    def test_no_permite_reprogramar_con_oferta_reasignacion_activa(self):
        self.client_api.force_authenticate(self.user_cliente)

        turno_cancelado_dummy = Turno.objects.create(
            cliente=self.otro_cliente,
            empleado=self.profesional,
            servicio=self.servicio,
            fecha_hora=timezone.now() + timedelta(hours=55),
            estado="cancelado",
            senia_pagada=Decimal("0.00"),
            tipo_pago="SIN_PAGO",
            precio_final=Decimal("12000.00"),
        )

        LogReasignacion.objects.create(
            turno_cancelado=turno_cancelado_dummy,
            turno_ofrecido=self.turno,
            cliente_notificado=self.cliente,
            monto_descuento=Decimal("0.00"),
            expires_at=timezone.now() + timedelta(minutes=20),
        )

        response = self.client_api.post(
            f"/api/turnos/{self.turno.id}/reprogramar/",
            {"nueva_fecha_hora": (timezone.now() + timedelta(hours=60)).isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("oferta de reasignacion activa", response.data.get("error", ""))
