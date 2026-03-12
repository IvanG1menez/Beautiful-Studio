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
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.utils.dateparse import parse_datetime

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
        porcentaje_sena = Decimal(str(servicio.porcentaje_sena or 0))
        usar_sena = data.get("usar_sena", True)

        # Precio base: seña o total
        if usar_sena and porcentaje_sena > 0:
            monto_base = (precio_total * porcentaje_sena / Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
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
            "usar_sena": usar_sena,
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
                },
            )
            if not turno_creado:
                logger.info(
                    "Webhook MP: turno pk=%s ya existía (slot ocupado), reutilizando.",
                    turno_wh.pk,
                )

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
