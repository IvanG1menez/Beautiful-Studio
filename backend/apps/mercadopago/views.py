"""
Vistas de la app Mercado Pago.

Endpoints:
    POST /api/mercadopago/preferencia/                       → Crea preferencia desde un turno existente.
    POST /api/mercadopago/preferencia-sin-turno/             → Crea preferencia SIN crear turno todavía.
    POST /api/mercadopago/webhook/                           → Recibe notificaciones IPN de Mercado Pago.
    GET  /api/mercadopago/pagos/                             → Lista los pagos (propietario/admin).
    GET  /api/mercadopago/verificar-pago/<preference_id>/   → Polling: verifica si el pago fue aprobado.
"""

import json
import logging
import uuid
from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO

from django.db import transaction
from django.http import HttpResponse
from django.utils.dateparse import parse_datetime
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.conf import settings

from apps.turnos.models import Turno
from apps.clientes.models import Cliente
from apps.servicios.models import Servicio
from apps.empleados.models import Empleado
from .models import PagoMercadoPago
from .serializers import (
    CrearPreferenciaSerializer,
    CrearPreferenciaSinTurnoSerializer,
    CrearPreferenciaStaffSerializer,
    PagoMercadoPagoSerializer,
)
from . import services

logger = logging.getLogger(__name__)


class CrearPreferenciaView(APIView):
    """
    POST /api/mercadopago/preferencia/

    Body: { "turno_id": <int> }

    Crea una preferencia en MP a partir de un turno existente.
    Devuelve preference_id + init_point para que el frontend inicialice el Wallet SDK.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = CrearPreferenciaSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        turno_id = serializer.validated_data["turno_id"]

        try:
            turno = Turno.objects.select_related("cliente__user", "servicio").get(
                pk=turno_id
            )
        except Turno.DoesNotExist:
            return Response(
                {"detail": f"No se encontró el turno con ID {turno_id}."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # No duplicar si ya existe un pago aprobado
        if hasattr(turno, "pago_mercadopago"):
            pago_existente = turno.pago_mercadopago
            if pago_existente.estado == "approved":
                return Response(
                    {
                        "detail": "Este turno ya tiene un pago aprobado.",
                        "preference_id": pago_existente.preference_id,
                        "init_point": pago_existente.init_point,
                    },
                    status=status.HTTP_200_OK,
                )

        descripcion = turno.servicio.nombre if turno.servicio else "Servicio"
        monto = (
            float(turno.servicio.precio)
            if turno.servicio and turno.servicio.precio
            else 0.0
        )
        descripcion_pago = f"Turno #{turno.pk} — {descripcion}"

        # 1. Persistir como pending antes de llamar al SDK
        pago, _ = PagoMercadoPago.objects.update_or_create(
            turno=turno,
            defaults={
                "cliente": turno.cliente,
                "preference_id": f"PENDING-TURNO-{turno.pk}",
                "init_point": "",
                "monto": monto,
                "moneda": settings.MP_CURRENCY_ID,
                "descripcion": descripcion_pago,
                "estado": "pending",
            },
        )

        payer_email = ""
        if turno.cliente and turno.cliente.user:
            payer_email = turno.cliente.user.email or ""

        # 2. Crear preferencia en MP
        try:
            resultado = services.crear_preferencia(
                titulo=descripcion,
                descripcion=descripcion_pago,
                monto=monto,
                external_reference=str(turno.pk),
                payer_email=payer_email,
            )
        except ValueError as exc:
            logger.error(
                "Error creando preferencia MP para turno %s: %s", turno_id, exc
            )
            pago.delete()
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        # 3. Actualizar registro con datos reales
        pago.preference_id = resultado["preference_id"]
        pago.init_point = resultado["init_point"]
        pago.save(update_fields=["preference_id", "init_point", "actualizado_en"])

        logger.info(
            "Preferencia MP creada — turno=%s preference_id=%s pago_id=%s",
            turno.pk,
            resultado["preference_id"],
            pago.pk,
        )

        return Response(
            {
                "preference_id": resultado["preference_id"],
                "init_point": resultado["init_point"],
                "sandbox_init_point": resultado["sandbox_init_point"],
                "pago_id": pago.pk,
                "public_key": getattr(settings, "MP_PUBLIC_KEY", ""),
            },
            status=status.HTTP_201_CREATED,
        )


class CrearPreferenciaSinTurnoView(APIView):
    """
    POST /api/mercadopago/preferencia-sin-turno/

    Crea una preferencia de MP con los datos del turno codificados en external_reference.
    El turno NO se crea aquí — se crea en el webhook cuando el pago es aprobado.

    Body: {
        "servicio_id": <int>,
        "empleado_id": <int>,
        "fecha_hora":  "2026-03-06T15:00:00",
        "notas_cliente": "..."  (opcional)
    }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = CrearPreferenciaSinTurnoSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        # Verificar que el cliente existe para el usuario autenticado
        try:
            cliente = Cliente.objects.select_related("user").get(user=request.user)
        except Cliente.DoesNotExist:
            return Response(
                {"detail": "No se encontró perfil de cliente para este usuario."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Obtener servicio para precio y nombre
        try:
            servicio = Servicio.objects.get(pk=data["servicio_id"], is_active=True)
        except Servicio.DoesNotExist:
            return Response(
                {"detail": f"Servicio {data['servicio_id']} no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Verificar que el empleado existe
        try:
            Empleado.objects.get(pk=data["empleado_id"])
        except Empleado.DoesNotExist:
            return Response(
                {"detail": f"Profesional {data['empleado_id']} no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── Cálculo de monto ────────────────────────────────────────────────────────
        precio_total = Decimal(str(servicio.precio or 0))
        # Aplicar descuento de fidelización si el frontend lo indica (flujo de
        # emails de retorno para clientes sin saldo en billetera).
        if data.get("aplicar_descuento_fidelizacion"):
            from apps.authentication.models import ConfiguracionGlobal

            descuento_monto = getattr(servicio, "descuento_fidelizacion_monto", None)
            descuento_pct = getattr(servicio, "descuento_fidelizacion_pct", None)

            descuento_monto = Decimal(str(descuento_monto or 0))
            descuento_pct = Decimal(str(descuento_pct or 0))

            if descuento_monto > 0:
                precio_total = max(Decimal("0"), precio_total - descuento_monto)
            elif descuento_pct > 0:
                precio_total = (
                    precio_total * (Decimal("100") - descuento_pct) / Decimal("100")
                ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            else:
                # Fallback al porcentaje global de fidelización si el servicio
                # no tiene descuento específico configurado.
                config_global = ConfiguracionGlobal.get_config()
                global_pct = Decimal(
                    str(getattr(config_global, "descuento_fidelizacion_pct", 0) or 0)
                )
                if global_pct > 0:
                    precio_total = (
                        precio_total * (Decimal("100") - global_pct) / Decimal("100")
                    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        tipo_pago = (data.get("tipo_pago") or "").upper()
        if tipo_pago not in {"SENIA", "PAGO_COMPLETO"}:
            usar_sena = data.get("usar_sena", True)
            tipo_pago = "SENIA" if usar_sena else "PAGO_COMPLETO"

        monto_sena_fijo = Decimal(str(getattr(servicio, "monto_sena_fijo", 0) or 0))
        if monto_sena_fijo <= 0 and precio_total > 0:
            monto_sena_fijo = (precio_total / Decimal("2")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )

        # Precio base: seña fija o total
        if tipo_pago == "SENIA":
            monto_base = monto_sena_fijo
        else:
            monto_base = precio_total

        # Créditos de billetera: validar contra saldo real y no superar el monto base
        creditos_solicitados = Decimal(str(data.get("creditos_a_aplicar") or 0))
        creditos_aplicados = Decimal("0")
        try:
            billetera_obj = cliente.billetera
            creditos_aplicados = min(
                creditos_solicitados, billetera_obj.saldo, monto_base
            )
            creditos_aplicados = max(creditos_aplicados, Decimal("0"))
        except Exception:
            creditos_aplicados = Decimal("0")

        monto_final = round(float(monto_base - creditos_aplicados), 2)
        descripcion = f"Turno — {servicio.nombre}"

        # ── Caso gratuito: saldo cubre el 100% ─────────────────────────────
        if monto_final <= 0:
            # Descontar créditos de la billetera
            if creditos_aplicados > 0:
                try:
                    cliente.billetera.descontar_saldo(
                        creditos_aplicados,
                        motivo=f"Seña turno — {servicio.nombre}",
                    )
                except Exception as exc:
                    logger.error("Error descontando saldo billetera: %s", exc)

            # Crear Turno directamente (sin Mercado Pago)
            empleado_obj = Empleado.objects.get(pk=data["empleado_id"])
            turno = Turno.objects.create(
                cliente=cliente,
                servicio=servicio,
                empleado=empleado_obj,
                fecha_hora=data["fecha_hora"],
                notas_cliente=data.get("notas_cliente", "") or "",
                estado="confirmado",
                precio_final=servicio.precio,
                senia_pagada=max(Decimal("0.00"), monto_base),
                tipo_pago=tipo_pago,
            )
            logger.info(
                "Turno gratuito creado (créditos 100%%) pk=%s cliente=%s",
                turno.pk,
                cliente.pk,
            )
            return Response(
                {"status": "free", "turno_id": turno.pk},
                status=status.HTTP_201_CREATED,
            )

        # ── Validar mínimo de Mercado Pago ─────────────────────────────────
        min_mp_amount = float(getattr(settings, "MP_MIN_AMOUNT", 100))
        if monto_final < min_mp_amount:
            return Response(
                {
                    "detail": (
                        f"El monto a cobrar (${monto_final:.2f}) es inferior al mínimo "
                        f"permitido por Mercado Pago (${min_mp_amount:.2f} ARS). "
                        "Revisá los créditos aplicados."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Codificar datos del turno en external_reference ─────────────────
        turno_payload = {
            "cliente_id": cliente.pk,
            "servicio_id": servicio.pk,
            "empleado_id": data["empleado_id"],
            "fecha_hora": data["fecha_hora"].isoformat(),
            "notas_cliente": data.get("notas_cliente", "") or "",
            "usar_sena": tipo_pago == "SENIA",
            "tipo_pago": tipo_pago,
            "creditos_aplicados": str(creditos_aplicados),
            "monto_cobrado": str(monto_final),
        }
        external_reference = json.dumps(turno_payload)

        notification_url = getattr(settings, "MERCADO_PAGO_WEBHOOK_URL", "")

        try:
            resultado = services.crear_preferencia(
                titulo=servicio.nombre,
                descripcion=descripcion,
                monto=monto_final,
                external_reference=external_reference,
                notification_url=notification_url,
                payer_email=cliente.user.email or "",
            )
        except ValueError as exc:
            logger.error("Error creando preferencia MP sin turno: %s", exc)
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        logger.info(
            "Preferencia sin turno creada — cliente=%s servicio=%s monto=%.2f preference_id=%s",
            cliente.pk,
            servicio.pk,
            monto_final,
            resultado["preference_id"],
        )

        return Response(
            {
                "status": "pending",
                "preference_id": resultado["preference_id"],
                "init_point": resultado["init_point"],
                "sandbox_init_point": resultado["sandbox_init_point"],
                "public_key": getattr(settings, "MP_PUBLIC_KEY", ""),
            },
            status=status.HTTP_201_CREATED,
        )


class CrearPreferenciaStaffView(APIView):
    """Crea una preferencia MP para pagos iniciados desde el panel.

    POST /api/mercadopago/preferencia-staff/

    El turno se creará en el webhook, igual que en el flujo sin turno, pero
    el cliente puede ser walk-in (creado al vuelo) o ya existente.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = CrearPreferenciaStaffSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        # Permisos básicos
        user = request.user
        if not (
            user.is_staff
            or getattr(user, "role", None)
            in ["propietario", "superusuario", "profesional"]
        ):
            return Response(
                {"detail": "No tiene permisos para iniciar pagos desde el panel."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Resolver o crear cliente
        from apps.clientes.models import Cliente
        from apps.users.models import User

        cliente = None
        ya_registrado = True

        cliente_id = data.get("cliente_id")
        if cliente_id:
            cliente = (
                Cliente.objects.select_related("user").filter(pk=cliente_id).first()
            )

        dni = (data.get("dni") or "").strip()
        email = (data.get("email") or "").strip()

        if cliente is None and dni:
            cliente = (
                Cliente.objects.select_related("user").filter(user__dni=dni).first()
            )

        if cliente is None and email:
            cliente = (
                Cliente.objects.select_related("user").filter(user__email=email).first()
            )

        if cliente is None:
            ya_registrado = False
            nombre = (data.get("nombre") or "").strip() or "Cliente"
            telefono = (data.get("telefono") or "").strip() or None

            partes_nombre = nombre.split(" ", 1)
            first_name = partes_nombre[0]
            last_name = partes_nombre[1] if len(partes_nombre) > 1 else ""

            username_base = email or (dni and f"cliente-{dni}") or None
            if not username_base:
                username_base = f"cliente-{uuid.uuid4().hex[:8]}"

            user_email = email or f"no-email-{uuid.uuid4().hex[:8]}@example.com"

            user_obj = User.objects.create_user(
                username=username_base,
                email=user_email,
                first_name=first_name,
                last_name=last_name,
            )
            user_obj.role = "cliente"
            user_obj.dni = dni or None
            user_obj.phone = telefono
            user_obj.set_unusable_password()
            user_obj.save()

            cliente = Cliente.objects.create(user=user_obj)

        # Obtener servicio y empleado
        try:
            servicio = Servicio.objects.get(pk=data["servicio_id"], is_active=True)
        except Servicio.DoesNotExist:
            return Response(
                {"detail": f"Servicio {data['servicio_id']} no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            Empleado.objects.get(pk=data["empleado_id"])
        except Empleado.DoesNotExist:
            return Response(
                {"detail": f"Profesional {data['empleado_id']} no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Cálculo de monto (seña o total, sin billetera)
        precio_total = Decimal(str(servicio.precio or 0))
        tipo_pago = (data.get("tipo_pago") or "").upper()
        if tipo_pago not in {"SENIA", "PAGO_COMPLETO"}:
            usar_sena = data.get("usar_sena", True)
            tipo_pago = "SENIA" if usar_sena else "PAGO_COMPLETO"

        monto_sena_fijo = Decimal(str(getattr(servicio, "monto_sena_fijo", 0) or 0))
        if monto_sena_fijo <= 0 and precio_total > 0:
            monto_sena_fijo = (precio_total / Decimal("2")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )

        if tipo_pago == "SENIA":
            monto_base = monto_sena_fijo
        else:
            monto_base = precio_total

        monto_final = round(float(monto_base), 2)

        min_mp_amount = float(getattr(settings, "MP_MIN_AMOUNT", 100))
        if monto_final < min_mp_amount:
            return Response(
                {
                    "detail": (
                        f"El monto a cobrar (${monto_final:.2f}) es inferior al mínimo "
                        f"permitido por Mercado Pago (${min_mp_amount:.2f} ARS)."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        canal_reserva = (
            "panel_profesional"
            if getattr(user, "role", None) == "profesional"
            else "panel_propietario"
        )

        turno_payload = {
            "cliente_id": cliente.pk,
            "servicio_id": servicio.pk,
            "empleado_id": data["empleado_id"],
            "fecha_hora": data["fecha_hora"].isoformat(),
            "notas_cliente": data.get("notas_cliente", "") or "",
            "usar_sena": tipo_pago == "SENIA",
            "tipo_pago": tipo_pago,
            "creditos_aplicados": "0",
            "monto_cobrado": str(monto_final),
            "canal_reserva": canal_reserva,
            "metodo_pago": "mercadopago_qr",
            "es_cliente_registrado": ya_registrado,
            "walkin_nombre": data.get("nombre") or "",
            "walkin_dni": dni,
            "walkin_email": email,
            "walkin_telefono": data.get("telefono") or "",
        }

        external_reference = json.dumps(turno_payload)
        notification_url = getattr(settings, "MERCADO_PAGO_WEBHOOK_URL", "")

        try:
            resultado = services.crear_preferencia(
                titulo=servicio.nombre,
                descripcion=f"Turno — {servicio.nombre}",
                monto=monto_final,
                external_reference=external_reference,
                notification_url=notification_url,
                payer_email=cliente.user.email or "",
            )
        except ValueError as exc:
            logger.error("Error creando preferencia MP staff: %s", exc)
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        logger.info(
            "Preferencia staff creada — cliente=%s servicio=%s monto=%.2f preference_id=%s",
            cliente.pk,
            servicio.pk,
            monto_final,
            resultado["preference_id"],
        )

        return Response(
            {
                "status": "pending",
                "preference_id": resultado["preference_id"],
                "init_point": resultado["init_point"],
                "sandbox_init_point": resultado["sandbox_init_point"],
                "public_key": getattr(settings, "MP_PUBLIC_KEY", ""),
            },
            status=status.HTTP_201_CREATED,
        )


@method_decorator(csrf_exempt, name="dispatch")
class WebhookMercadoPagoView(APIView):
    """
    POST /api/mercadopago/webhook/

    Acepta notificaciones IPN de Mercado Pago para topic=payment y
    topic=merchant_order.  Siempre devuelve 200 para evitar reintentos
    infinitos de MP.
    """

    permission_classes = [AllowAny]

    # ── helpers ──────────────────────────────────────────────────────────────

    def _crear_turno_desde_payload(
        self,
        turno_payload: dict,
        payment_id: str,
        mp_preference_id: str,
        monto_cobrado_override: float | None = None,
    ) -> None:
        """
        Crea Turno + PagoMercadoPago a partir de un turno_payload.
        Completamente idempotente:
          - Si ya existe PagoMercadoPago con esa preference_id → no hace nada.
          - Si el slot (empleado, fecha_hora) ya está ocupado → reutiliza ese
            Turno y le asocia el PagoMercadoPago sin duplicar el Turno.
        """
        # La API de MP a veces omite preference_id en el objeto payment.
        # En ese caso, el webhook merchant_order (que siempre lo tiene) creará el
        # PagoMercadoPago correctamente. Aquí simplemente no hacemos nada.
        if not mp_preference_id:
            logger.warning(
                "Webhook MP: preference_id vacío para payment_id=%s. "
                "El webhook merchant_order procesará el pago con el preference_id correcto.",
                payment_id,
            )
            return

        cliente_wh = Cliente.objects.get(pk=turno_payload["cliente_id"])
        servicio_wh = Servicio.objects.get(pk=turno_payload["servicio_id"])
        empleado_wh = Empleado.objects.get(pk=turno_payload["empleado_id"])
        fecha_hora_wh = parse_datetime(turno_payload["fecha_hora"])

        monto_cobrado = Decimal(
            str(
                monto_cobrado_override
                or turno_payload.get("monto_cobrado")
                or servicio_wh.precio
                or 0
            )
        )
        creditos_wh = Decimal(str(turno_payload.get("creditos_aplicados") or 0))

        # Monto ya abonado por el cliente al momento de crear el turno.
        # Incluye tanto el pago vía MP como los créditos de billetera aplicados.
        senia_total = monto_cobrado + max(creditos_wh, Decimal("0"))

        canal_reserva = turno_payload.get("canal_reserva")
        metodo_pago = turno_payload.get("metodo_pago") or "mercadopago"
        tipo_pago = (turno_payload.get("tipo_pago") or "").upper()
        if tipo_pago not in {"SENIA", "PAGO_COMPLETO", "SIN_PAGO"}:
            usar_sena_payload = bool(turno_payload.get("usar_sena", True))
            tipo_pago = "SENIA" if usar_sena_payload else "PAGO_COMPLETO"
        es_cliente_registrado = bool(turno_payload.get("es_cliente_registrado", True))
        walkin_nombre = turno_payload.get("walkin_nombre") or ""
        walkin_dni = turno_payload.get("walkin_dni") or ""
        walkin_email = turno_payload.get("walkin_email") or ""
        walkin_telefono = turno_payload.get("walkin_telefono") or ""

        with transaction.atomic():
            # Idempotente sobre el slot único (empleado + fecha_hora).
            # Si el turno ya existe (reintento de webhook, test previo, etc.)
            # lo reutilizamos — nunca lanzamos IntegrityError.
            turno_wh, turno_creado = Turno.objects.get_or_create(
                empleado=empleado_wh,
                fecha_hora=fecha_hora_wh,
                defaults={
                    "cliente": cliente_wh,
                    "servicio": servicio_wh,
                    "notas_cliente": turno_payload.get("notas_cliente", "") or "",
                    "estado": "confirmado",
                    "precio_final": servicio_wh.precio,
                    "senia_pagada": max(Decimal("0"), senia_total),
                    "canal_reserva": canal_reserva,
                    "metodo_pago": metodo_pago,
                    "tipo_pago": tipo_pago,
                    "es_cliente_registrado": es_cliente_registrado,
                    "walkin_nombre": walkin_nombre or None,
                    "walkin_dni": walkin_dni or None,
                    "walkin_email": walkin_email or None,
                    "walkin_telefono": walkin_telefono or None,
                },
            )
            if not turno_creado:
                logger.info(
                    "Webhook MP: turno pk=%s ya existía (slot ocupado), reutilizando.",
                    turno_wh.pk,
                )

                # Actualizar metadatos de canal/pago si aún no están seteados
                campos_update = []
                if canal_reserva and not turno_wh.canal_reserva:
                    turno_wh.canal_reserva = canal_reserva
                    campos_update.append("canal_reserva")
                if metodo_pago and not turno_wh.metodo_pago:
                    turno_wh.metodo_pago = metodo_pago
                    campos_update.append("metodo_pago")
                if tipo_pago and not turno_wh.tipo_pago:
                    turno_wh.tipo_pago = tipo_pago
                    campos_update.append("tipo_pago")
                if (
                    not turno_wh.walkin_nombre
                    and walkin_nombre
                    and not es_cliente_registrado
                ):
                    turno_wh.walkin_nombre = walkin_nombre
                    campos_update.append("walkin_nombre")
                if not turno_wh.walkin_dni and walkin_dni and not es_cliente_registrado:
                    turno_wh.walkin_dni = walkin_dni
                    campos_update.append("walkin_dni")
                if (
                    not turno_wh.walkin_email
                    and walkin_email
                    and not es_cliente_registrado
                ):
                    turno_wh.walkin_email = walkin_email
                    campos_update.append("walkin_email")
                if (
                    not turno_wh.walkin_telefono
                    and walkin_telefono
                    and not es_cliente_registrado
                ):
                    turno_wh.walkin_telefono = walkin_telefono
                    campos_update.append("walkin_telefono")
                if campos_update:
                    turno_wh.save(update_fields=campos_update)

                # Si el turno ya existía pero no tiene registrada la seña, la
                # actualizamos con el monto abonado en este flujo.
                if not turno_wh.senia_pagada or turno_wh.senia_pagada <= 0:
                    turno_wh.senia_pagada = max(Decimal("0"), senia_total)
                    turno_wh.save(update_fields=["senia_pagada"])

            # Búsqueda en dos pasos para evitar conflicto en la OneToOne turno_id:
            #   1. Por preference_id  → reintento exacto del mismo webhook.
            #   2. Por turno          → el turno ya tiene un pago (p.ej. el topic
            #                           opuesto llegó primero y creó el registro).
            pago_por_preference = PagoMercadoPago.objects.filter(
                preference_id=mp_preference_id
            ).first()
            if pago_por_preference is not None:
                logger.info(
                    "Webhook MP: PagoMercadoPago ya registrado preference_id=%s, ignorando.",
                    mp_preference_id,
                )
                return

            pago_por_turno = PagoMercadoPago.objects.filter(turno=turno_wh).first()
            if pago_por_turno is not None:
                if not pago_por_turno.preference_id:
                    # El turno tiene un PagoMercadoPago con preference_id vacío
                    # (creado por un webhook payment cuya respuesta de API no
                    # incluía preference_id). Actualizamos al ID correcto para
                    # que el polling pueda resolverse.
                    logger.info(
                        "Webhook MP: actualizando preference_id vacío → %s (turno pk=%s).",
                        mp_preference_id,
                        turno_wh.pk,
                    )
                    pago_por_turno.preference_id = mp_preference_id
                    pago_por_turno.estado = "approved"
                    pago_por_turno.payment_id = str(payment_id)
                    pago_por_turno.save(
                        update_fields=[
                            "preference_id",
                            "estado",
                            "payment_id",
                            "actualizado_en",
                        ]
                    )
                    # El signal post_save del Turno ya se disparó cuando se creó
                    # el turno (on_commit). Como ahora el pago fue actualizado
                    # DESPUÉS de ese commit, los emails no se enviaron aún.
                    # Los enviamos explícitamente aquí.
                    from apps.turnos.signals import _enviar_notificaciones_nuevo_turno

                    _enviar_notificaciones_nuevo_turno(turno_wh.pk)
                else:
                    logger.info(
                        "Webhook MP: PagoMercadoPago pk=%s ya registrado para "
                        "turno pk=%s (preference_id=%s), ignorando.",
                        pago_por_turno.pk,
                        turno_wh.pk,
                        pago_por_turno.preference_id,
                    )
                return

            pago_wh = PagoMercadoPago.objects.create(
                preference_id=mp_preference_id,
                turno=turno_wh,
                cliente=cliente_wh,
                payment_id=str(payment_id),
                init_point="",
                monto=monto_cobrado,
                moneda=settings.MP_CURRENCY_ID,
                descripcion=f"Turno #{turno_wh.pk} — {servicio_wh.nombre}",
                estado="approved",
            )

        # Descontar créditos de billetera fuera del atomic (error no crítico)
        if creditos_wh > 0:
            try:
                cliente_wh.billetera.descontar_saldo(
                    creditos_wh,
                    motivo=f"Seña turno #{turno_wh.pk} — {servicio_wh.nombre}",
                )
            except Exception as exc_bil:
                logger.error(
                    "Webhook MP: error descontando saldo billetera: %s", exc_bil
                )

        print(
            f"¡TURNO CREADO EN DB! pk={turno_wh.pk} preference_id={mp_preference_id} payment_id={payment_id}"
        )
        logger.info(
            "Webhook MP: ¡TURNO CREADO! pk=%s monto=%.2f payment_id=%s preference_id=%s",
            turno_wh.pk,
            float(monto_cobrado),
            payment_id,
            mp_preference_id,
        )

    def _parse_turno_payload(self, external_reference: str) -> dict | None:
        """Intenta parsear el external_reference como JSON. Devuelve None si no es el nuevo flujo."""
        try:
            parsed = json.loads(external_reference)
            if isinstance(parsed, dict) and "cliente_id" in parsed:
                return parsed
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
        return None

    # ── handler principal ─────────────────────────────────────────────────────

    def post(self, request, *args, **kwargs):
        data = request.data
        topic = data.get("type") or request.query_params.get("topic", "")
        resource_id = data.get("data", {}).get("id") or request.query_params.get("id")

        logger.info(
            "Webhook MP recibido — topic=%s resource_id=%s body=%s qs=%s",
            topic,
            resource_id,
            str(data)[:600],
            dict(request.query_params),
        )

        if not resource_id:
            logger.info("Webhook MP ignorado: sin resource_id")
            return Response({"detail": "Sin resource_id."}, status=status.HTTP_200_OK)

        # ── topic=payment ─────────────────────────────────────────────────────
        if topic == "payment":
            try:
                pago_mp = services.obtener_pago(str(resource_id))
            except ValueError as exc:
                logger.error(
                    "Webhook MP: no se pudo obtener pago %s: %s", resource_id, exc
                )
                return Response(
                    {"detail": "Error consultando pago."}, status=status.HTTP_200_OK
                )

            external_reference = pago_mp.get("external_reference", "")
            nuevo_estado = pago_mp.get("status", "")
            mp_preference_id = pago_mp.get("preference_id", "")

            logger.info(
                "Webhook payment: estado=%s preference_id=%s ext_ref=%.120s",
                nuevo_estado,
                mp_preference_id,
                external_reference,
            )

            turno_payload = self._parse_turno_payload(external_reference)

            if turno_payload is not None:
                # ── nuevo flujo ──
                if nuevo_estado == "approved":
                    try:
                        self._crear_turno_desde_payload(
                            turno_payload, resource_id, mp_preference_id
                        )
                    except Exception as exc:
                        logger.error(
                            "Webhook MP (payment): error creando turno: %s", exc
                        )
                else:
                    logger.info(
                        "Webhook MP (payment): estado=%s, no se crea turno.",
                        nuevo_estado,
                    )
            else:
                # ── flujo clásico ──
                try:
                    turno_id_clasico = int(external_reference)
                    pago = PagoMercadoPago.objects.get(turno_id=turno_id_clasico)
                    pago.payment_id = str(resource_id)
                    pago.estado = nuevo_estado
                    pago.save(update_fields=["payment_id", "estado", "actualizado_en"])
                    logger.info(
                        "Webhook MP (clásico): turno=%s estado=%s",
                        turno_id_clasico,
                        nuevo_estado,
                    )
                except (TypeError, ValueError):
                    logger.warning(
                        "Webhook MP: external_reference inválido: %s",
                        external_reference,
                    )
                except PagoMercadoPago.DoesNotExist:
                    logger.warning(
                        "Webhook MP: sin registro para turno_id=%s", external_reference
                    )

            return Response(status=status.HTTP_200_OK)

        # ── topic=merchant_order ──────────────────────────────────────────────
        if topic == "merchant_order":
            try:
                orden = services.obtener_orden(str(resource_id))
            except ValueError as exc:
                logger.error(
                    "Webhook MP: no se pudo obtener orden %s: %s", resource_id, exc
                )
                return Response(
                    {"detail": "Error consultando orden."}, status=status.HTTP_200_OK
                )

            external_reference = orden.get("external_reference", "")
            mp_preference_id = orden.get("preference_id", "")
            pagos_orden = orden.get("payments", [])

            logger.info(
                "Webhook merchant_order: preference_id=%s pagos=%s ext_ref=%.120s",
                mp_preference_id,
                [{"id": p.get("id"), "status": p.get("status")} for p in pagos_orden],
                external_reference,
            )

            turno_payload = self._parse_turno_payload(external_reference)
            if turno_payload is None:
                logger.info(
                    "Webhook merchant_order: external_reference no es nuevo flujo, ignorando."
                )
                return Response(status=status.HTTP_200_OK)

            # Buscar el primer pago aprobado en la orden
            pago_aprobado = next(
                (p for p in pagos_orden if p.get("status") == "approved"), None
            )

            if pago_aprobado:
                payment_id_aprobado = pago_aprobado.get("id", resource_id)
                monto_cobrado = float(
                    pago_aprobado.get("total_paid_amount")
                    or turno_payload.get("monto_cobrado")
                    or 0
                )
                try:
                    self._crear_turno_desde_payload(
                        turno_payload,
                        payment_id_aprobado,
                        mp_preference_id,
                        monto_cobrado_override=monto_cobrado or None,
                    )
                except Exception as exc:
                    logger.error(
                        "Webhook MP (merchant_order): error creando turno: %s", exc
                    )
            else:
                logger.info(
                    "Webhook merchant_order: ningún pago aprobado aún (estados=%s).",
                    [p.get("status") for p in pagos_orden],
                )

            return Response(status=status.HTTP_200_OK)

        # ── otros topics (merchant_order:updated, etc.) ───────────────────────
        logger.info("Webhook MP: topic=%s ignorado.", topic)
        return Response({"detail": "Topic ignorado."}, status=status.HTTP_200_OK)


class VerificarPagoView(APIView):
    """
    GET /api/mercadopago/verificar-pago/<preference_id>/

    Polling: el frontend pregunta si el pago de una preferencia fue aprobado.

    Responde:
        {"status": "approved", "turno_id": <int>}  → Turno creado y pago registrado
        {"status": "pending"}                       → Webhook aún no llegó
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, preference_id: str, *args, **kwargs):
        try:
            pago = PagoMercadoPago.objects.select_related("turno").get(
                preference_id=preference_id,
                estado="approved",
            )
            return Response(
                {"status": "approved", "turno_id": pago.turno.pk},
                status=status.HTTP_200_OK,
            )
        except PagoMercadoPago.DoesNotExist:
            # Fallback sin webhook: consultar MP por preference_id.
            # Si MP confirma aprobado, registrar turno/pago localmente de forma
            # idempotente reutilizando la misma lógica del webhook.
            try:
                pago_mp = services.buscar_pago_aprobado_por_preference(preference_id)
            except ValueError as exc:
                logger.warning(
                    "VerificarPago fallback MP falló para preference_id=%s: %s",
                    preference_id,
                    exc,
                )
                return Response({"status": "pending"}, status=status.HTTP_200_OK)

            if not pago_mp:
                return Response({"status": "pending"}, status=status.HTTP_200_OK)

            external_reference = pago_mp.get("external_reference", "")
            turno_payload = WebhookMercadoPagoView()._parse_turno_payload(
                external_reference
            )

            if turno_payload is None:
                logger.warning(
                    "VerificarPago fallback: external_reference no corresponde al flujo nuevo "
                    "(preference_id=%s)",
                    preference_id,
                )
                return Response({"status": "pending"}, status=status.HTTP_200_OK)

            payment_id = str(pago_mp.get("id") or "")
            monto_cobrado = float(
                pago_mp.get("transaction_amount")
                or turno_payload.get("monto_cobrado")
                or 0
            )

            try:
                WebhookMercadoPagoView()._crear_turno_desde_payload(
                    turno_payload,
                    payment_id,
                    preference_id,
                    monto_cobrado_override=monto_cobrado or None,
                )
            except Exception as exc:
                logger.error(
                    "VerificarPago fallback: error registrando pago/turno preference_id=%s: %s",
                    preference_id,
                    exc,
                )
                return Response({"status": "pending"}, status=status.HTTP_200_OK)

            try:
                pago = PagoMercadoPago.objects.select_related("turno").get(
                    preference_id=preference_id,
                    estado="approved",
                )
                return Response(
                    {"status": "approved", "turno_id": pago.turno.pk},
                    status=status.HTTP_200_OK,
                )
            except PagoMercadoPago.DoesNotExist:
                return Response({"status": "pending"}, status=status.HTTP_200_OK)


class ListarPagosView(APIView):
    """
    GET /api/mercadopago/pagos/

    Lista todos los pagos. Solo propietario/admin.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(status=status.HTTP_403_FORBIDDEN)
        pagos = PagoMercadoPago.objects.select_related("turno", "cliente__user").all()
        serializer = PagoMercadoPagoSerializer(pagos, many=True)
        return Response(serializer.data)


class ComprobantePagoView(APIView):
    """Devuelve los datos del comprobante de pago de un turno específico.

    GET /api/mercadopago/comprobante/<turno_id>/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, turno_id: int, *args, **kwargs):
        from apps.authentication.models import ConfiguracionGlobal

        try:
            pago = (
                PagoMercadoPago.objects.select_related(
                    "turno",
                    "turno__servicio",
                    "turno__empleado__user",
                    "cliente__user",
                )
                .filter(turno_id=turno_id, estado="approved")
                .first()
            )
            if not pago:
                return Response(
                    {"detail": "No hay un pago aprobado asociado a este turno."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            turno = pago.turno

            # Datos de configuración / empresa
            config = ConfiguracionGlobal.get_config()
            fecha_fundacion = config.fecha_fundacion

            data = {
                "empresa": {
                    "nombre_empresa": config.nombre_empresa or "Beautiful Studio",
                    "nombre_comercial": config.nombre_comercial or "Beautiful Studio",
                    "razon_social": config.razon_social or "",
                    "cuit": config.cuit or "",
                    "fecha_fundacion": (
                        fecha_fundacion.isoformat() if fecha_fundacion else None
                    ),
                },
                "turno": {
                    "id": turno.id,
                    "servicio_nombre": getattr(turno.servicio, "nombre", ""),
                    "profesional_nombre": getattr(
                        turno.empleado.user, "get_full_name", lambda: ""
                    )(),
                    "cliente_nombre": getattr(turno.cliente, "nombre_completo", ""),
                    "cliente_email": getattr(
                        getattr(turno.cliente, "user", None), "email", ""
                    ),
                    "fecha_hora": (
                        turno.fecha_hora.isoformat() if turno.fecha_hora else None
                    ),
                    "duracion_minutos": getattr(
                        turno.servicio, "duracion_minutos", None
                    ),
                    "precio_servicio": str(getattr(turno.servicio, "precio", "")),
                    "precio_final": str(turno.precio_final or ""),
                    "senia_pagada": str(turno.senia_pagada or "0"),
                },
                "pago": {
                    "monto": str(pago.monto),
                    "moneda": pago.moneda,
                    "descripcion": pago.descripcion,
                    "payment_id": pago.payment_id,
                    "preference_id": pago.preference_id,
                    "estado": pago.estado,
                    "creado_en": pago.creado_en.isoformat(),
                },
            }

            return Response(data, status=status.HTTP_200_OK)

        except Exception as exc:
            return Response(
                {"detail": f"Error al obtener comprobante: {str(exc)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ComprobantePagoPDFView(APIView):
    """Devuelve un comprobante de pago en formato PDF para un turno.

    GET /api/mercadopago/comprobante/<turno_id>/pdf/

    El PDF se genera a partir del pago aprobado asociado al turno.
    """

    # Permitimos acceso sin autenticación porque este endpoint se usará
    # desde links enviados por email al cliente.
    permission_classes = []

    def get(self, request, turno_id: int, *args, **kwargs):
        from apps.authentication.models import ConfiguracionGlobal

        try:
            pago = (
                PagoMercadoPago.objects.select_related(
                    "turno",
                    "turno__servicio",
                    "turno__empleado__user",
                    "cliente__user",
                )
                .filter(turno_id=turno_id, estado="approved")
                .first()
            )
            if not pago:
                return Response(
                    {"detail": "No hay un pago aprobado asociado a este turno."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            turno = pago.turno

            # Datos de configuración / empresa
            config = ConfiguracionGlobal.get_config()
            fecha_fundacion = config.fecha_fundacion

            buffer = BytesIO()
            pdf = canvas.Canvas(buffer, pagesize=A4)
            width, height = A4

            y = height - 50

            # Encabezado de empresa
            pdf.setFont("Helvetica-Bold", 16)
            pdf.drawString(
                40,
                y,
                config.nombre_empresa or config.nombre_comercial or "Beautiful Studio",
            )
            y -= 18

            pdf.setFont("Helvetica", 10)
            if config.razon_social:
                pdf.drawString(40, y, f"Razón social: {config.razon_social}")
                y -= 14
            if config.cuit:
                pdf.drawString(40, y, f"CUIT: {config.cuit}")
                y -= 14
            if fecha_fundacion:
                pdf.drawString(
                    40,
                    y,
                    f"Inicio de actividades: {fecha_fundacion.strftime('%d/%m/%Y')}",
                )
                y -= 20

            pdf.setFont("Helvetica-Bold", 12)
            pdf.drawString(40, y, "Comprobante de Pago de Turno")
            y -= 10
            pdf.setFont("Helvetica", 10)
            pdf.drawString(
                40,
                y,
                f"Fecha de emisión: {pago.creado_en.strftime('%d/%m/%Y %H:%M')} hs",
            )
            y -= 24

            # Datos del cliente
            pdf.setFont("Helvetica-Bold", 11)
            pdf.drawString(40, y, "Datos del cliente")
            y -= 16
            pdf.setFont("Helvetica", 10)
            pdf.drawString(
                40, y, f"Nombre: {getattr(turno.cliente, 'nombre_completo', '')}"
            )
            y -= 14
            cliente_email = getattr(getattr(turno.cliente, "user", None), "email", "")
            if cliente_email:
                pdf.drawString(40, y, f"Email: {cliente_email}")
                y -= 18

            # Datos del turno
            pdf.setFont("Helvetica-Bold", 11)
            pdf.drawString(40, y, "Datos del turno")
            y -= 16
            pdf.setFont("Helvetica", 10)
            pdf.drawString(40, y, f"ID de turno: {turno.id}")
            y -= 14
            pdf.drawString(
                40,
                y,
                f"Servicio: {getattr(turno.servicio, 'nombre', '')}",
            )
            y -= 14
            pdf.drawString(
                40,
                y,
                f"Profesional: {turno.empleado.user.get_full_name()}",
            )
            y -= 14
            if turno.fecha_hora:
                pdf.drawString(
                    40,
                    y,
                    f"Fecha y hora: {turno.fecha_hora.strftime('%d/%m/%Y %H:%M')} hs",
                )
                y -= 18

            # Detalle del pago
            pdf.setFont("Helvetica-Bold", 11)
            pdf.drawString(40, y, "Detalle del pago")
            y -= 16
            pdf.setFont("Helvetica", 10)
            pdf.drawString(
                40,
                y,
                f"Monto abonado: ${pago.monto} {pago.moneda}",
            )
            y -= 14
            if turno.senia_pagada:
                pdf.drawString(
                    40,
                    y,
                    f"Seña acumulada: ${turno.senia_pagada}",
                )
                y -= 14
            if turno.precio_final:
                pdf.drawString(
                    40,
                    y,
                    f"Precio final del turno: ${turno.precio_final}",
                )
                y -= 14

            pdf.drawString(40, y, f"Medio de pago: Mercado Pago")
            y -= 14
            pdf.drawString(40, y, f"ID de pago: {pago.payment_id}")
            y -= 14
            pdf.drawString(40, y, f"Estado: {pago.estado}")
            y -= 24

            pdf.setFont("Helvetica-Oblique", 9)
            pdf.drawString(
                40,
                y,
                "Este comprobante es válido como constancia de pago emitida por Beautiful Studio.",
            )

            pdf.showPage()
            pdf.save()

            buffer.seek(0)
            response = HttpResponse(buffer.read(), content_type="application/pdf")
            response["Content-Disposition"] = (
                f'attachment; filename="comprobante_turno_{turno.id}.pdf"'
            )
            return response

        except Exception as exc:
            logger.exception("Error generando comprobante PDF")
            return Response(
                {"detail": f"Error al generar comprobante PDF: {str(exc)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
