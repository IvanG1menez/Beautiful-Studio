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
import secrets
import uuid
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO

from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
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

from apps.turnos.models import StreakCoupon, Turno
from apps.turnos.serializers import calcular_monto_pendiente_turno
from apps.clientes.models import Cliente
from apps.servicios.models import Servicio
from apps.empleados.models import Empleado
from apps.authentication.models import AuditoriaAcciones
from apps.emails.models import PasswordResetToken
from apps.emails.services import EmailService
from .models import OrdenMercadoPagoPresencial, PagoMercadoPago, PreferenciaMercadoPagoCancelada
from .serializers import (
    CancelarPagoStaffSerializer,
    ConfirmarPagoManualSerializer,
    ConfirmarPagoStaffSerializer,
    CrearCobroTurnoStaffSerializer,
    CrearPreferenciaSerializer,
    CrearPreferenciaSinTurnoSerializer,
    CrearPreferenciaReprogramacionSerializer,
    CrearPreferenciaStaffSerializer,
    PagoMercadoPagoSerializer,
)
from . import services
from apps.turnos.services.reprogramacion_service import (
    reprogramar_turno,
    validar_rango_reprogramacion,
)

logger = logging.getLogger(__name__)


def _slot_turno_disponible(empleado: Empleado, servicio: Servicio, fecha_hora) -> bool:
    if not fecha_hora or fecha_hora <= timezone.now():
        return False

    hora_fin = fecha_hora + timedelta(minutes=servicio.duracion_minutos)
    turnos_dia = Turno.objects.select_related("servicio").filter(
        empleado=empleado,
        fecha_hora__date=fecha_hora.date(),
        estado__in=["pendiente", "confirmado", "en_proceso"],
    )
    for turno in turnos_dia:
        if not turno.fecha_hora or not turno.servicio:
            continue
        inicio_existente = turno.fecha_hora
        fin_existente = inicio_existente + timedelta(
            minutes=turno.servicio.duracion_minutos
        )
        if fecha_hora < fin_existente and hora_fin > inicio_existente:
            return False
    return True


def _registrar_auditoria_staff(usuario, accion: str, modelo: str, objeto_id: int | None, detalles: dict) -> None:
    try:
        AuditoriaAcciones.objects.create(
            usuario=usuario,
            accion=accion,
            modelo_afectado=modelo,
            objeto_id=objeto_id,
            detalles=detalles,
        )
    except Exception as exc:
        logger.warning("No se pudo registrar auditoria staff: %s", exc)


def _enviar_link_crear_password(cliente: Cliente, usuario_actor=None, origen: str = "") -> None:
    user_obj = getattr(cliente, "user", None)
    if not user_obj or not user_obj.email or user_obj.has_usable_password():
        return

    PasswordResetToken.objects.filter(user=user_obj, used=False).update(used=True)
    reset_token = PasswordResetToken.objects.create(
        user=user_obj,
        token=secrets.token_urlsafe(32),
        expires_at=timezone.now() + timedelta(hours=24),
    )
    email_enviado = EmailService.enviar_email_recuperacion_password(
        email=user_obj.email,
        token=reset_token.token,
        usuario_nombre=user_obj.first_name or "",
        es_creacion_cuenta=True,
        validez_horas=24,
    )
    _registrar_auditoria_staff(
        usuario_actor,
        "crear",
        "PasswordResetToken",
        reset_token.id,
        {
            "evento": "envio_link_crear_password_cliente",
            "cliente_id": cliente.id,
            "email": user_obj.email,
            "origen": origen,
            "email_enviado": email_enviado,
        },
    )


def _actualizar_telefono_cliente_staff(cliente: Cliente, telefono: str, usuario_actor=None, origen: str = "") -> None:
    telefono = (telefono or "").strip()
    if not telefono or not getattr(cliente, "user", None):
        return
    telefono_anterior = cliente.user.phone or ""
    if telefono_anterior == telefono:
        return
    cliente.user.phone = telefono
    cliente.user.save(update_fields=["phone"])
    _registrar_auditoria_staff(
        usuario_actor,
        "editar",
        "Cliente",
        cliente.id,
        {
            "evento": "telefono_cliente_actualizado_por_staff",
            "telefono_anterior": telefono_anterior,
            "telefono_nuevo": telefono,
            "origen": origen,
        },
    )


def _expire_stale_streak_coupons(cliente):
    now = timezone.now()
    StreakCoupon.objects.filter(
        cliente=cliente,
        status__in=["pendiente", "reclamado"],
        expires_at__lt=now,
    ).update(status="vencido", updated_at=now)


def _get_valid_streak_coupon(cliente, code):
    code = (code or "").strip().upper()
    if not code:
        return None, None

    _expire_stale_streak_coupons(cliente)
    coupon = StreakCoupon.objects.filter(cliente=cliente, code=code).first()
    if not coupon:
        return None, "Cupón inválido."
    if coupon.status == "usado":
        return None, "Ya usaste tu código de descuento."
    if coupon.status != "reclamado":
        return None, "Cupón inválido."
    return coupon, None


def _mark_streak_coupon_used(coupon_id, turno):
    if not coupon_id:
        return
    with transaction.atomic():
        now = timezone.now()
        coupon = StreakCoupon.objects.select_for_update().filter(pk=coupon_id).first()
        if not coupon or coupon.status != "reclamado":
            logger.warning(
                "Cupón de racha no disponible al marcar uso: coupon_id=%s turno=%s",
                coupon_id,
                turno.pk,
            )
            return
        coupon.status = "usado"
        coupon.used_at = now
        coupon.used_turno = turno
        coupon.save(update_fields=["status", "used_at", "used_turno", "updated_at"])
        from apps.turnos.models import ClienteStreakStats

        ClienteStreakStats.objects.filter(cliente=coupon.cliente).update(
            streak_count=0,
            last_completed_turno=None,
            last_completed_at=None,
            next_expiration_at=None,
            updated_at=now,
        )


def _resolver_o_crear_cliente_staff_desde_payload(turno_payload: dict) -> tuple[Cliente, bool]:
    """Resuelve el cliente de una reserva staff y crea walk-ins solo tras pago aprobado."""
    from apps.users.models import User

    cliente_id = turno_payload.get("cliente_id")
    usuario_actor = None
    staff_user_id = turno_payload.get("staff_user_id")
    if staff_user_id:
        usuario_actor = User.objects.filter(pk=staff_user_id).first()

    if cliente_id:
        cliente = Cliente.objects.select_related("user").get(pk=cliente_id)
        _actualizar_telefono_cliente_staff(
            cliente,
            turno_payload.get("walkin_telefono") or "",
            usuario_actor=usuario_actor,
            origen="reserva_presencial_qr",
        )
        return cliente, True

    dni = (turno_payload.get("walkin_dni") or "").strip()
    email = (turno_payload.get("walkin_email") or "").strip().lower()
    telefono = (turno_payload.get("walkin_telefono") or "").strip()
    nombre = (turno_payload.get("walkin_nombre") or "").strip() or "Cliente"

    cliente = None
    if dni:
        cliente = Cliente.objects.select_related("user").filter(user__dni=dni).first()
    if cliente is None and email:
        cliente = Cliente.objects.select_related("user").filter(user__email=email).first()
    if cliente is not None:
        dni_cliente = (getattr(cliente.user, "dni", "") or "").strip()
        if email and (not dni or dni_cliente != dni):
            raise ValueError(
                "Este email ya pertenece a un cliente registrado. Buscá al cliente por DNI o verificá los datos antes de continuar."
            )
        _actualizar_telefono_cliente_staff(
            cliente,
            telefono,
            usuario_actor=usuario_actor,
            origen="reserva_presencial_qr",
        )
        return cliente, True

    partes_nombre = nombre.split(" ", 1)
    first_name = partes_nombre[0]
    last_name = partes_nombre[1] if len(partes_nombre) > 1 else ""

    if not email:
        raise ValueError("El email es obligatorio para registrar un cliente nuevo.")

    user_obj = User.objects.filter(email=email).first()
    if user_obj is None and dni:
        user_obj = User.objects.filter(dni=dni).first()

    if user_obj is None:
        username_base = email or (dni and f"cliente-{dni}") or f"cliente-{uuid.uuid4().hex[:8]}"
        username = username_base
        counter = 1
        while User.objects.filter(username=username).exists():
            counter += 1
            username = f"{username_base}-{counter}"

        user_obj = User.objects.create_user(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
        )
        user_obj.role = "cliente"
        user_obj.dni = dni or None
        user_obj.phone = telefono or None
        user_obj.set_unusable_password()
        user_obj.save()
    else:
        campos_update = []
        if not user_obj.first_name and first_name:
            user_obj.first_name = first_name
            campos_update.append("first_name")
        if not user_obj.last_name and last_name:
            user_obj.last_name = last_name
            campos_update.append("last_name")
        if not getattr(user_obj, "dni", None) and dni:
            user_obj.dni = dni
            campos_update.append("dni")
        if not getattr(user_obj, "phone", None) and telefono:
            user_obj.phone = telefono
            campos_update.append("phone")
        if getattr(user_obj, "role", None) != "cliente":
            user_obj.role = "cliente"
            campos_update.append("role")
        if campos_update:
            user_obj.save(update_fields=campos_update)

    cliente, created = Cliente.objects.get_or_create(user=user_obj)
    if created:
        _registrar_auditoria_staff(
            usuario_actor,
            "crear",
            "Cliente",
            cliente.id,
            {
                "evento": "cliente_creado_por_reserva_presencial",
                "email": user_obj.email,
                "dni": dni,
                "origen": "reserva_presencial_qr",
            },
        )
        _enviar_link_crear_password(
            cliente,
            usuario_actor=usuario_actor,
            origen="reserva_presencial_qr",
        )
    return cliente, not created


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

        pago_existente = turno.pagos_mercadopago.filter(estado="approved").first()
        if pago_existente:
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
        pago = PagoMercadoPago.objects.create(
            turno=turno,
            cliente=turno.cliente,
            preference_id=f"PENDING-TURNO-{turno.pk}-{uuid.uuid4().hex[:8]}",
            init_point="",
            monto=monto,
            moneda=settings.MP_CURRENCY_ID,
            descripcion=descripcion_pago,
            estado="pending",
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

        if data.get("aplicar_descuento_fidelizacion") and data.get("cliente_id"):
            cliente_oferta = Cliente.objects.select_related("user").filter(
                pk=data["cliente_id"]
            ).first()
            if not cliente_oferta:
                return Response(
                    {"detail": "No se encontró el cliente de la oferta."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            cliente = cliente_oferta

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
            empleado_obj = Empleado.objects.get(pk=data["empleado_id"])
        except Empleado.DoesNotExist:
            return Response(
                {"detail": f"Profesional {data['empleado_id']} no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        es_oferta_fidelizacion = bool(data.get("aplicar_descuento_fidelizacion"))
        fecha_hora_reserva = data["fecha_hora"]
        if es_oferta_fidelizacion and not _slot_turno_disponible(
            empleado_obj, servicio, fecha_hora_reserva
        ):
            from apps.emails.tasks import _buscar_proximo_horario_disponible

            fecha_recalculada = _buscar_proximo_horario_disponible(
                empleado_obj, servicio
            )
            if not fecha_recalculada:
                return Response(
                    {"detail": "No hay horarios libres para esta oferta."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            fecha_hora_reserva = fecha_recalculada

        # ── Cálculo de monto ────────────────────────────────────────────────────────
        precio_original = Decimal(str(servicio.precio or 0))
        precio_total = precio_original
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

        streak_coupon = None
        streak_coupon_discount = Decimal("0")
        coupon_code = (data.get("coupon_code") or "").strip().upper()
        if coupon_code:
            streak_coupon, coupon_error = _get_valid_streak_coupon(cliente, coupon_code)
            if coupon_error:
                return Response({"detail": coupon_error}, status=status.HTTP_400_BAD_REQUEST)
            if Decimal(str(streak_coupon.discount_amount or 0)) >= precio_total:
                return Response(
                    {"detail": "El cupón no puede cubrir todo el valor del servicio."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            streak_coupon_discount = min(
                Decimal(str(streak_coupon.discount_amount or 0)),
                precio_total,
            )
            precio_total = max(Decimal("0"), precio_total - streak_coupon_discount)

        tipo_pago = (data.get("tipo_pago") or "").upper()
        if tipo_pago not in {"SENIA", "PAGO_COMPLETO"}:
            usar_sena = data.get("usar_sena", True)
            tipo_pago = "SENIA" if usar_sena else "PAGO_COMPLETO"

        monto_sena_fijo = Decimal(str(getattr(servicio, "monto_sena_fijo", 0) or 0))
        if data.get("aplicar_descuento_fidelizacion"):
            monto_sena_fijo = Decimal("0")
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
        es_oferta_fidelizacion = bool(data.get("aplicar_descuento_fidelizacion"))
        notas_cliente = data.get("notas_cliente", "") or ""
        if es_oferta_fidelizacion and "Oferta de cliente olvidado" not in notas_cliente:
            notas_cliente = (notas_cliente + "\n" if notas_cliente else "") + "Oferta de cliente olvidado aplicada."

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
                notas_cliente=notas_cliente,
                estado="confirmado",
                precio_final=precio_total,
                senia_pagada=max(Decimal("0.00"), monto_base),
                tipo_pago=tipo_pago,
                canal_reserva="fidelizacion" if es_oferta_fidelizacion else "web_cliente",
                metodo_pago="mercadopago_qr" if data.get("usar_qr") else "mercadopago",
            )
            if streak_coupon:
                _mark_streak_coupon_used(streak_coupon.id, turno)
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
            "precio_total_original": str(precio_original),
            "precio_total_final": str(precio_total),
            "streak_coupon_id": streak_coupon.id if streak_coupon else None,
            "streak_coupon_code": streak_coupon.code if streak_coupon else "",
            "streak_coupon_discount": str(streak_coupon_discount),
            "canal_reserva": "fidelizacion" if es_oferta_fidelizacion else "web_cliente",
            "metodo_pago": "mercadopago_qr" if data.get("usar_qr") else "mercadopago",
            "aplicar_descuento_fidelizacion": es_oferta_fidelizacion,
        }
        external_reference = json.dumps(turno_payload)

        notification_url = getattr(settings, "MERCADO_PAGO_WEBHOOK_URL", "")

        if data.get("usar_qr"):
            qr_access_token = (getattr(settings, "MP_QR_ACCESS_TOKEN", "") or "").strip()
            qr_collector_id = str(
                getattr(settings, "MP_QR_COLLECTOR_ID", "")
                or getattr(settings, "MP_QR_SELLER_COLLECTOR_ID", "")
            ).strip()
            qr_pos_external_id = str(getattr(settings, "MP_QR_POS_EXTERNAL_ID", "")).strip()
            if not qr_access_token or not qr_collector_id or not qr_pos_external_id:
                return Response(
                    {
                        "detail": (
                            "Configuración QR incompleta: revisá MP_QR_ACCESS_TOKEN, "
                            "MP_QR_COLLECTOR_ID y MP_QR_POS_EXTERNAL_ID."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            reference_id = f"cliente-qr-{uuid.uuid4().hex}"
            try:
                orden_mp = services.crear_orden_qr_dinamico(
                    collector_id=qr_collector_id,
                    external_pos_id=qr_pos_external_id,
                    reference_id=reference_id,
                    titulo=servicio.nombre,
                    descripcion=descripcion,
                    monto=monto_final,
                    notification_url=notification_url,
                )
            except Exception as exc:
                logger.error("Error creando QR para reserva cliente: %s", exc)
                return Response(
                    {"detail": f"Mercado Pago rechazó el QR: {exc}"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            qr_data = orden_mp.get("qr_data") or orden_mp.get("qr") or ""
            if not qr_data:
                return Response(
                    {"detail": "Mercado Pago creó la orden QR, pero no devolvió datos de QR."},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            OrdenMercadoPagoPresencial.objects.create(
                reference_id=reference_id,
                payload=turno_payload,
                qr_data=qr_data,
                monto=Decimal(str(monto_final)),
            )
            qr_public_key = getattr(settings, "MP_QR_PUBLIC_KEY", "") or getattr(settings, "MP_PUBLIC_KEY", "")
            return Response(
                {
                    "status": "pending",
                    "preference_id": reference_id,
                    "qr_data": qr_data,
                    "qr_init_point": qr_data,
                    "fecha_hora": fecha_hora_reserva.isoformat(),
                    "qr_native": True,
                    "public_key": qr_public_key,
                    "qr_public_key": qr_public_key,
                },
                status=status.HTTP_201_CREATED,
            )

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
                "fecha_hora": fecha_hora_reserva.isoformat(),
                "public_key": getattr(settings, "MP_PUBLIC_KEY", ""),
            },
            status=status.HTTP_201_CREATED,
        )


class CrearPreferenciaReprogramacionView(APIView):
    """Crea una preferencia MP para reprogramar un turno existente fuera de rango."""

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = CrearPreferenciaReprogramacionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        try:
            turno = Turno.objects.select_related("cliente__user", "servicio", "empleado").get(
                pk=data["turno_id"]
            )
        except Turno.DoesNotExist:
            return Response(
                {"detail": "No se encontró el turno a reprogramar."},
                status=status.HTTP_404_NOT_FOUND,
            )

        es_cliente_duenio = hasattr(request.user, "cliente_profile") and (
            turno.cliente_id == request.user.cliente_profile.id
        )
        es_admin = request.user.is_staff or request.user.role in ["propietario", "superusuario"]
        if not (es_cliente_duenio or es_admin):
            return Response(
                {"detail": "No tiene permisos para pagar esta reprogramación."},
                status=status.HTTP_403_FORBIDDEN,
            )

        from apps.authentication.models import ConfiguracionGlobal

        config = ConfiguracionGlobal.get_config()
        brecha_horas = max(1, int(config.min_horas_cancelacion_credito or 24))
        ahora = timezone.now()
        dentro_de_rango_pago = ahora > turno.fecha_hora - timedelta(hours=brecha_horas)
        if not dentro_de_rango_pago:
            return Response(
                {"detail": "Este turno aún puede reprogramarse sin penalidad de pago."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if data["nueva_fecha_hora"] <= ahora:
            return Response(
                {"detail": "La nueva fecha y hora debe ser futura."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if es_cliente_duenio:
            try:
                validar_rango_reprogramacion(turno, data["nueva_fecha_hora"], ahora)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        precio_total = Decimal(str(turno.servicio.precio or turno.precio_final or 0))
        monto_sena = Decimal(str(getattr(turno.servicio, "monto_sena_fijo", 0) or 0))
        if monto_sena <= 0 and precio_total > 0:
            monto_sena = (precio_total / Decimal("2")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )

        tipo_pago = data["tipo_pago"]
        monto_final_decimal = monto_sena if tipo_pago == "SENIA" else precio_total
        monto_final = round(float(monto_final_decimal), 2)

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

        empleado_destino_id = data.get("nuevo_empleado_id") or turno.empleado_id
        payload = {
            "tipo_movimiento": "reprogramacion_turno",
            "turno_id": turno.id,
            "cliente_id": turno.cliente_id,
            "servicio_id": turno.servicio_id,
            "empleado_id": empleado_destino_id,
            "nueva_fecha_hora": data["nueva_fecha_hora"].isoformat(),
            "motivo": data.get("motivo") or "",
            "tipo_pago": tipo_pago,
            "monto_cobrado": str(monto_final_decimal),
        }

        descripcion = f"Reprogramación turno #{turno.pk} — {turno.servicio.nombre}"
        notification_url = getattr(settings, "MERCADO_PAGO_WEBHOOK_URL", "")

        try:
            resultado = services.crear_preferencia(
                titulo=f"Reprogramación — {turno.servicio.nombre}",
                descripcion=descripcion,
                monto=monto_final,
                external_reference=json.dumps(payload),
                notification_url=notification_url,
                payer_email=turno.cliente.user.email or "",
            )
        except ValueError as exc:
            logger.error("Error creando preferencia MP reprogramación: %s", exc)
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        PagoMercadoPago.objects.create(
            preference_id=resultado["preference_id"],
            turno=turno,
            cliente=turno.cliente,
            payment_id=None,
            init_point=resultado["init_point"],
            monto=monto_final_decimal,
            moneda=settings.MP_CURRENCY_ID,
            descripcion=descripcion,
            estado="pending",
        )

        return Response(
            {
                "status": "pending",
                "preference_id": resultado["preference_id"],
                "init_point": resultado["init_point"],
                "sandbox_init_point": resultado["sandbox_init_point"],
                "public_key": getattr(settings, "MP_PUBLIC_KEY", ""),
                "tipo_pago": tipo_pago,
                "monto": str(monto_final_decimal),
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
            if cliente is not None:
                dni_cliente = (getattr(cliente.user, "dni", "") or "").strip()
                if not dni or dni_cliente != dni:
                    return Response(
                        {
                            "detail": (
                                "Este email ya pertenece a un cliente registrado. "
                                "Buscá al cliente por DNI o verificá los datos antes de continuar."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        if cliente is None and not email:
            return Response(
                {
                    "detail": (
                        "Para cobrar por QR a un cliente no registrado, cargá un email válido. "
                        "El cliente se registrará recién cuando Mercado Pago confirme el pago."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if cliente is None:
            ya_registrado = False

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
            "cliente_id": cliente.pk if cliente else None,
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
            "staff_user_id": user.pk,
            "walkin_nombre": data.get("nombre") or "",
            "walkin_dni": dni,
            "walkin_email": email,
            "walkin_telefono": data.get("telefono") or "",
        }

        external_reference = json.dumps(turno_payload)
        notification_url = getattr(settings, "MERCADO_PAGO_WEBHOOK_URL", "")
        mp_env = (getattr(settings, "MP_ENV", "prod") or "prod").lower()
        access_token = (getattr(settings, "MP_ACCESS_TOKEN", "") or "").strip()
        token_env = "test" if access_token.startswith("TEST-") else "prod"

        if getattr(settings, "MP_QR_NATIVE_ENABLED", True):
            qr_access_token = (getattr(settings, "MP_QR_ACCESS_TOKEN", "") or "").strip()
            qr_collector_id = str(
                getattr(settings, "MP_QR_COLLECTOR_ID", "")
                or getattr(settings, "MP_QR_SELLER_COLLECTOR_ID", "")
            ).strip()
            qr_pos_external_id = str(getattr(settings, "MP_QR_POS_EXTERNAL_ID", "")).strip()
            if not qr_access_token or not qr_collector_id or not qr_pos_external_id:
                return Response(
                    {
                        "detail": (
                            "Configuración QR incompleta: revisá MP_QR_ACCESS_TOKEN, "
                            "MP_QR_COLLECTOR_ID y MP_QR_POS_EXTERNAL_ID."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            reference_id = f"staff-qr-{uuid.uuid4().hex}"
            titulo_orden = f"Reserva presencial - {servicio.nombre}"
            try:
                orden_mp = services.crear_orden_qr_dinamico(
                    collector_id=qr_collector_id,
                    external_pos_id=qr_pos_external_id,
                    reference_id=reference_id,
                    titulo=titulo_orden,
                    descripcion=f"Turno {servicio.nombre}",
                    monto=monto_final,
                    notification_url=notification_url,
                )
            except Exception as exc:
                logger.error(
                    "Error creando orden QR nativa MP staff: %s",
                    exc,
                )
                return Response(
                    {"detail": f"Mercado Pago rechazó el QR nativo: {exc}"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            else:
                qr_data = orden_mp.get("qr_data") or orden_mp.get("qr") or ""
                if qr_data:
                    qr_public_key = getattr(settings, "MP_QR_PUBLIC_KEY", "") or getattr(settings, "MP_PUBLIC_KEY", "")
                    OrdenMercadoPagoPresencial.objects.create(
                        reference_id=reference_id,
                        payload=turno_payload,
                        qr_data=qr_data,
                        monto=Decimal(str(monto_final)),
                    )

                    logger.info(
                        "Orden QR staff creada — reference_id=%s servicio=%s monto=%.2f",
                        reference_id,
                        servicio.pk,
                        monto_final,
                    )
                    return Response(
                        {
                            "status": "pending",
                            "preference_id": reference_id,
                            "qr_data": qr_data,
                            "qr_init_point": qr_data,
                            "qr_native": True,
                            "mp_env": mp_env,
                            "mp_token_env": token_env,
                            "qr_link_kind": "qr_data",
                            "public_key": qr_public_key,
                            "qr_public_key": qr_public_key,
                        },
                        status=status.HTTP_201_CREATED,
                    )
                logger.error(
                    "Mercado Pago creó la orden QR staff sin qr_data. Respuesta: %s",
                    orden_mp,
                )
                return Response(
                    {"detail": "Mercado Pago creó la orden QR, pero no devolvió datos de QR."},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        try:
            titulo_preferencia = f"Turno {servicio.nombre}"
            resultado = services.crear_preferencia(
                titulo=titulo_preferencia,
                descripcion=f"Reserva presencial - {servicio.nombre}",
                monto=monto_final,
                external_reference=external_reference,
                notification_url=notification_url,
                payer_email="",
            )
        except ValueError as exc:
            logger.error("Error creando preferencia MP staff: %s", exc)
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        logger.info(
            "Preferencia staff creada — cliente=%s servicio=%s monto=%.2f preference_id=%s",
            cliente.pk if cliente else "walk-in-pendiente",
            servicio.pk,
            monto_final,
            resultado["preference_id"],
        )
        qr_init_point = resultado["sandbox_init_point"] if token_env == "test" else resultado["init_point"]

        return Response(
            {
                "status": "pending",
                "preference_id": resultado["preference_id"],
                "init_point": resultado["init_point"],
                "sandbox_init_point": resultado["sandbox_init_point"],
                "qr_init_point": qr_init_point,
                "mp_env": mp_env,
                "mp_token_env": token_env,
                "qr_link_kind": "sandbox_init_point" if token_env == "test" else "init_point",
                "public_key": getattr(settings, "MP_PUBLIC_KEY", ""),
            },
            status=status.HTTP_201_CREATED,
        )


class ConfirmarPagoStaffView(APIView):
    """Valida manualmente un ID de operación MP para el flujo presencial."""

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = ConfirmarPagoStaffSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        if not (
            user.is_staff
            or getattr(user, "role", None)
            in ["propietario", "superusuario", "profesional"]
        ):
            return Response(
                {"detail": "No tiene permisos para confirmar pagos desde el panel."},
                status=status.HTTP_403_FORBIDDEN,
            )

        preference_id = serializer.validated_data["preference_id"]
        payment_id = serializer.validated_data["payment_id"]

        if PreferenciaMercadoPagoCancelada.objects.filter(preference_id=preference_id).exists():
            return Response(
                {"detail": "Esta transacción fue cancelada. Generá un nuevo QR para registrar el pago."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pago_existente = PagoMercadoPago.objects.select_related("turno").filter(
            preference_id=preference_id,
            estado="approved",
        ).order_by("-actualizado_en").first()
        if pago_existente:
            if pago_existente.payment_id != payment_id:
                pago_existente.payment_id = payment_id
                pago_existente.save(update_fields=["payment_id", "actualizado_en"])
            return Response(
                {"status": "approved", "turno_id": pago_existente.turno.pk, "payment_id": pago_existente.payment_id},
                status=status.HTTP_200_OK,
            )

        pago_mismo_id = PagoMercadoPago.objects.filter(
            payment_id=payment_id,
            estado="approved",
        ).exclude(preference_id=preference_id).first()
        if pago_mismo_id:
            return Response(
                {"detail": "Ese ID de operación ya fue registrado en otra reserva."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            pago_mp = services.obtener_pago(payment_id)
        except ValueError as exc:
            logger.warning("ConfirmarPagoStaff: no se pudo obtener pago %s con credenciales generales: %s. Reintentando QR.", payment_id, exc)
            try:
                pago_mp = services.obtener_pago(payment_id, use_qr_credentials=True)
            except ValueError as exc_qr:
                logger.warning("ConfirmarPagoStaff: no se pudo obtener pago %s con credenciales QR: %s", payment_id, exc_qr)
                return Response(
                    {"detail": "No se encontró ese ID de operación en Mercado Pago."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if pago_mp.get("status") != "approved":
            return Response(
                {"detail": "El pago existe, pero todavía no está aprobado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        orden_presencial = OrdenMercadoPagoPresencial.objects.filter(reference_id=preference_id).first()
        if orden_presencial is not None:
            external_reference = pago_mp.get("external_reference") or ""
            if external_reference != preference_id:
                return Response(
                    {"detail": "El ID de operación no corresponde al QR generado para esta reserva."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            monto_cobrado = float(
                pago_mp.get("transaction_amount") or orden_presencial.monto or 0
            )
            try:
                WebhookMercadoPagoView()._crear_turno_desde_orden_presencial(
                    orden_presencial,
                    payment_id,
                    monto_cobrado_override=monto_cobrado or None,
                )
            except Exception as exc:
                logger.error(
                    "ConfirmarPagoStaff QR nativo: error registrando pago/turno reference_id=%s payment_id=%s: %s",
                    preference_id,
                    payment_id,
                    exc,
                )
                return Response(
                    {"detail": "No se pudo registrar el pago aprobado en el sistema."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            pago = PagoMercadoPago.objects.select_related("turno").filter(
                preference_id=preference_id,
                estado="approved",
            ).first()
            if not pago:
                return Response(
                    {"detail": "El pago fue validado, pero no se encontró el turno creado."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                {"status": "approved", "turno_id": pago.turno.pk, "payment_id": pago.payment_id},
                status=status.HTTP_200_OK,
            )

        mp_preference_id = pago_mp.get("preference_id") or ""
        if mp_preference_id != preference_id:
            return Response(
                {"detail": "El ID de operación no corresponde al QR generado para esta reserva."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        turno_payload = WebhookMercadoPagoView()._parse_turno_payload(
            pago_mp.get("external_reference", "")
        )
        if turno_payload is None or turno_payload.get("tipo_movimiento") == "reprogramacion_turno":
            return Response(
                {"detail": "El pago no corresponde a una reserva presencial."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
                "ConfirmarPagoStaff: error registrando pago/turno preference_id=%s payment_id=%s: %s",
                preference_id,
                payment_id,
                exc,
            )
            return Response(
                {"detail": "No se pudo registrar el pago aprobado en el sistema."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pago = PagoMercadoPago.objects.select_related("turno").filter(
            preference_id=preference_id,
            payment_id=payment_id,
            estado="approved",
        ).first()
        if not pago:
            return Response(
                {"detail": "El pago fue validado, pero no se encontró el turno creado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {"status": "approved", "turno_id": pago.turno.pk, "payment_id": pago.payment_id},
            status=status.HTTP_200_OK,
        )


class CancelarPagoStaffView(APIView):
    """Marca una preferencia presencial como cancelada para ignorar confirmaciones tardías."""

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = CancelarPagoStaffSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        if not (
            user.is_staff
            or getattr(user, "role", None)
            in ["propietario", "superusuario", "profesional"]
        ):
            return Response(
                {"detail": "No tiene permisos para cancelar pagos desde el panel."},
                status=status.HTTP_403_FORBIDDEN,
            )

        preference_id = serializer.validated_data["preference_id"]
        if PagoMercadoPago.objects.filter(preference_id=preference_id, estado="approved").exists():
            return Response(
                {"detail": "El pago ya fue aprobado y no puede cancelarse desde este flujo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        OrdenMercadoPagoPresencial.objects.filter(
            reference_id=preference_id,
            estado="pending",
        ).update(estado="cancelled")

        PreferenciaMercadoPagoCancelada.objects.get_or_create(
            preference_id=preference_id,
            defaults={
                "motivo": "Cancelada desde reserva presencial",
                "cancelado_por": user,
            },
        )
        return Response({"status": "cancelled"}, status=status.HTTP_200_OK)


class CrearCobroTurnoStaffView(APIView):
    """Crea un QR para cobrar el saldo pendiente de un turno existente."""

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = CrearCobroTurnoStaffSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        es_staff_user = bool(
            user.is_staff
            or getattr(user, "role", None)
            in ["propietario", "superusuario", "profesional"]
        )

        try:
            turno = Turno.objects.select_related("cliente__user", "empleado", "servicio").get(
                pk=serializer.validated_data["turno_id"]
            )
        except Turno.DoesNotExist:
            return Response(
                {"detail": "No se encontró el turno."},
                status=status.HTTP_404_NOT_FOUND,
            )

        es_cliente_duenio = hasattr(user, "cliente_profile") and turno.cliente_id == user.cliente_profile.id

        if not es_staff_user and not es_cliente_duenio:
            return Response(
                {"detail": "No tiene permisos para cobrar este turno."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if getattr(user, "role", None) == "profesional":
            profesional = getattr(user, "profesional_profile", None)
            if not profesional or turno.empleado_id != profesional.id:
                return Response(
                    {"detail": "No puede cobrar un turno que no está asignado a usted."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        monto_pendiente = calcular_monto_pendiente_turno(turno)
        if monto_pendiente <= Decimal("0.00"):
            return Response(
                {"detail": "El turno no tiene saldo pendiente."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        monto_final = round(float(monto_pendiente), 2)
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

        payload = {
            "tipo_movimiento": "pago_saldo_turno",
            "turno_id": turno.pk,
            "monto_cobrado": str(monto_pendiente),
            "metodo_pago": "mercadopago_qr",
            "staff_user_id": user.pk,
            "cliente_id": turno.cliente_id,
        }
        notification_url = getattr(settings, "MERCADO_PAGO_WEBHOOK_URL", "")
        mp_env = (getattr(settings, "MP_ENV", "prod") or "prod").lower()
        access_token = (getattr(settings, "MP_ACCESS_TOKEN", "") or "").strip()
        token_env = "test" if access_token.startswith("TEST-") else "prod"

        if getattr(settings, "MP_QR_NATIVE_ENABLED", True):
            qr_access_token = (getattr(settings, "MP_QR_ACCESS_TOKEN", "") or "").strip()
            qr_collector_id = str(
                getattr(settings, "MP_QR_COLLECTOR_ID", "")
                or getattr(settings, "MP_QR_SELLER_COLLECTOR_ID", "")
            ).strip()
            qr_pos_external_id = str(getattr(settings, "MP_QR_POS_EXTERNAL_ID", "")).strip()
            if not qr_access_token or not qr_collector_id or not qr_pos_external_id:
                return Response(
                    {
                        "detail": (
                            "Configuración QR incompleta: revisá MP_QR_ACCESS_TOKEN, "
                            "MP_QR_COLLECTOR_ID y MP_QR_POS_EXTERNAL_ID."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            reference_id = f"turno-saldo-{turno.pk}-{uuid.uuid4().hex}"
            try:
                orden_mp = services.crear_orden_qr_dinamico(
                    collector_id=qr_collector_id,
                    external_pos_id=qr_pos_external_id,
                    reference_id=reference_id,
                    titulo=f"Saldo turno #{turno.pk}",
                    descripcion=f"Saldo pendiente - {turno.servicio.nombre}",
                    monto=monto_final,
                    notification_url=notification_url,
                )
            except Exception as exc:
                logger.error("Error creando QR para saldo de turno: %s", exc)
                return Response(
                    {"detail": f"Mercado Pago rechazó el QR nativo: {exc}"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            qr_data = orden_mp.get("qr_data") or orden_mp.get("qr") or ""
            if not qr_data:
                return Response(
                    {"detail": "Mercado Pago creó la orden QR, pero no devolvió datos de QR."},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            OrdenMercadoPagoPresencial.objects.create(
                reference_id=reference_id,
                payload=payload,
                qr_data=qr_data,
                monto=Decimal(str(monto_final)),
            )
            qr_public_key = getattr(settings, "MP_QR_PUBLIC_KEY", "") or getattr(settings, "MP_PUBLIC_KEY", "")
            return Response(
                {
                    "status": "pending",
                    "preference_id": reference_id,
                    "qr_data": qr_data,
                    "qr_init_point": qr_data,
                    "qr_native": True,
                    "mp_env": mp_env,
                    "mp_token_env": token_env,
                    "qr_link_kind": "qr_data",
                    "public_key": qr_public_key,
                    "qr_public_key": qr_public_key,
                    "monto": str(monto_pendiente),
                },
                status=status.HTTP_201_CREATED,
            )

        resultado = services.crear_preferencia(
            titulo=f"Saldo turno #{turno.pk}",
            descripcion=f"Saldo pendiente - {turno.servicio.nombre}",
            monto=monto_final,
            external_reference=json.dumps(payload),
            notification_url=notification_url,
            payer_email=getattr(turno.cliente.user, "email", "") if turno.cliente_id else "",
        )
        qr_init_point = resultado["sandbox_init_point"] if token_env == "test" else resultado["init_point"]
        return Response(
            {
                "status": "pending",
                "preference_id": resultado["preference_id"],
                "init_point": resultado["init_point"],
                "sandbox_init_point": resultado["sandbox_init_point"],
                "qr_init_point": qr_init_point,
                "mp_env": mp_env,
                "mp_token_env": token_env,
                "qr_link_kind": "sandbox_init_point" if token_env == "test" else "init_point",
                "public_key": getattr(settings, "MP_PUBLIC_KEY", ""),
                "monto": str(monto_pendiente),
            },
            status=status.HTTP_201_CREATED,
        )


class ConfirmarCobroManualView(APIView):
    """Registra un cobro confirmado manualmente cuando MP no confirma a tiempo."""

    permission_classes = [IsAuthenticated]

    def _obtener_pago_aprobado_validado(
        self,
        preference_id: str,
        payment_id: str,
        *,
        es_qr: bool = False,
        monto_esperado: Decimal | None = None,
    ) -> tuple[dict | None, Response | None]:
        try:
            pago_mp = services.obtener_pago(payment_id, use_qr_credentials=es_qr)
        except ValueError:
            try:
                pago_mp = services.obtener_pago(payment_id, use_qr_credentials=not es_qr)
            except ValueError:
                return None, Response(
                    {"detail": "No se encontró ese número de operación en Mercado Pago."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if pago_mp.get("status") != "approved":
            return None, Response(
                {"detail": "El pago existe, pero todavía no está aprobado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if es_qr:
            external_reference = pago_mp.get("external_reference") or ""
            if external_reference and external_reference != preference_id:
                return None, Response(
                    {"detail": "El número de operación no corresponde al QR generado para esta reserva."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not external_reference:
                try:
                    pago_por_orden = services.buscar_pago_aprobado_por_external_reference(
                        preference_id,
                        use_qr_credentials=True,
                    )
                except ValueError:
                    pago_por_orden = None
                if not pago_por_orden or str(pago_por_orden.get("id") or "") != str(payment_id):
                    return None, Response(
                        {"detail": "El número de operación no corresponde al QR generado para esta reserva."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
        else:
            mp_preference_id = pago_mp.get("preference_id") or ""
            if mp_preference_id != preference_id:
                return None, Response(
                    {"detail": "El número de operación no corresponde a esta preferencia de pago."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if monto_esperado is not None:
            monto_pagado = Decimal(str(pago_mp.get("transaction_amount") or 0))
            if monto_pagado.quantize(Decimal("0.01")) != monto_esperado.quantize(Decimal("0.01")):
                return None, Response(
                    {"detail": "El monto pagado no coincide con el monto de esta reserva."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        return pago_mp, None

    def _payload_reserva_manual(self, user, reserva_data: dict, preferencia: dict | None = None) -> tuple[dict | None, Response | None]:
        """Reconstruye el payload del turno si MP no devuelve external_reference."""
        if not reserva_data:
            return None, None

        serializer = CrearPreferenciaSinTurnoSerializer(data=reserva_data)
        if not serializer.is_valid():
            return None, Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            cliente = Cliente.objects.select_related("user").get(user=user)
        except Cliente.DoesNotExist:
            return None, Response(
                {"detail": "No se encontró perfil de cliente para este usuario."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if data.get("aplicar_descuento_fidelizacion") and data.get("cliente_id"):
            cliente_oferta = Cliente.objects.select_related("user").filter(
                pk=data["cliente_id"]
            ).first()
            if not cliente_oferta:
                return None, Response(
                    {"detail": "No se encontró el cliente de la oferta."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            cliente = cliente_oferta

        es_oferta_fidelizacion = bool(data.get("aplicar_descuento_fidelizacion"))

        try:
            servicio = Servicio.objects.get(pk=data["servicio_id"])
            empleado_obj = Empleado.objects.get(pk=data["empleado_id"])
        except (Servicio.DoesNotExist, Empleado.DoesNotExist):
            return None, Response(
                {"detail": "No se encontró el servicio o profesional de la reserva."},
                status=status.HTTP_404_NOT_FOUND,
            )

        fecha_hora_reserva = data["fecha_hora"]
        if es_oferta_fidelizacion and not _slot_turno_disponible(
            empleado_obj, servicio, fecha_hora_reserva
        ):
            from apps.emails.tasks import _buscar_proximo_horario_disponible

            fecha_recalculada = _buscar_proximo_horario_disponible(
                empleado_obj, servicio
            )
            if not fecha_recalculada:
                return None, Response(
                    {"detail": "No hay horarios libres para esta oferta."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            fecha_hora_reserva = fecha_recalculada

        precio_original = Decimal(str(servicio.precio or 0))
        precio_total = precio_original

        if es_oferta_fidelizacion:
            from apps.authentication.models import ConfiguracionGlobal

            descuento_monto = Decimal(str(getattr(servicio, "descuento_fidelizacion_monto", None) or 0))
            descuento_pct = Decimal(str(getattr(servicio, "descuento_fidelizacion_pct", None) or 0))

            if descuento_monto > 0:
                precio_total = max(Decimal("0"), precio_total - descuento_monto)
            elif descuento_pct > 0:
                precio_total = (
                    precio_total * (Decimal("100") - descuento_pct) / Decimal("100")
                ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            else:
                config = ConfiguracionGlobal.get_config()
                global_pct = Decimal(
                    str(getattr(config, "descuento_fidelizacion_pct", 0) or 0)
                )
                if global_pct > 0:
                    precio_total = (
                        precio_total * (Decimal("100") - global_pct) / Decimal("100")
                    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        streak_coupon = None
        streak_coupon_discount = Decimal("0")
        coupon_code = (data.get("coupon_code") or "").strip().upper()
        if coupon_code:
            streak_coupon, coupon_error = _get_valid_streak_coupon(cliente, coupon_code)
            if coupon_error:
                return None, Response({"detail": coupon_error}, status=status.HTTP_400_BAD_REQUEST)
            streak_coupon_discount = min(
                Decimal(str(streak_coupon.discount_amount or 0)),
                precio_total,
            )
            precio_total = max(Decimal("0"), precio_total - streak_coupon_discount)

        tipo_pago = (data.get("tipo_pago") or "").upper()
        if tipo_pago not in {"SENIA", "PAGO_COMPLETO"}:
            tipo_pago = "SENIA" if data.get("usar_sena", True) else "PAGO_COMPLETO"

        monto_sena_fijo = Decimal(str(getattr(servicio, "monto_sena_fijo", 0) or 0))
        if es_oferta_fidelizacion:
            monto_sena_fijo = Decimal("0")
        if monto_sena_fijo <= 0 and precio_total > 0:
            monto_sena_fijo = (precio_total / Decimal("2")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        monto_base = monto_sena_fijo if tipo_pago == "SENIA" else precio_total

        creditos_solicitados = Decimal(str(data.get("creditos_a_aplicar") or 0))
        creditos_aplicados = Decimal("0")
        try:
            creditos_aplicados = min(creditos_solicitados, cliente.billetera.saldo, monto_base)
            creditos_aplicados = max(creditos_aplicados, Decimal("0"))
        except Exception:
            creditos_aplicados = Decimal("0")

        monto_preferencia = Decimal("0")
        try:
            monto_preferencia = Decimal(str((preferencia.get("items") or [{}])[0].get("unit_price") or 0)) if preferencia else Decimal("0")
        except Exception:
            monto_preferencia = Decimal("0")

        monto_cobrado = monto_preferencia or (monto_base - creditos_aplicados)
        notas_cliente = data.get("notas_cliente", "") or ""
        if es_oferta_fidelizacion and "Oferta de cliente olvidado" not in notas_cliente:
            notas_cliente = (notas_cliente + "\n" if notas_cliente else "") + "Oferta de cliente olvidado aplicada."

        return {
            "cliente_id": cliente.pk,
            "servicio_id": servicio.pk,
            "empleado_id": data["empleado_id"],
            "fecha_hora": fecha_hora_reserva.isoformat(),
            "notas_cliente": notas_cliente,
            "usar_sena": tipo_pago == "SENIA",
            "tipo_pago": tipo_pago,
            "creditos_aplicados": str(creditos_aplicados),
            "monto_cobrado": str(max(Decimal("0"), monto_cobrado)),
            "precio_total_original": str(precio_original),
            "precio_total_final": str(precio_total),
            "streak_coupon_id": streak_coupon.id if streak_coupon else None,
            "streak_coupon_code": streak_coupon.code if streak_coupon else "",
            "streak_coupon_discount": str(streak_coupon_discount),
            "canal_reserva": "fidelizacion" if es_oferta_fidelizacion else "web_cliente",
            "metodo_pago": "mercadopago",
            "aplicar_descuento_fidelizacion": es_oferta_fidelizacion,
        }, None

    def post(self, request, *args, **kwargs):
        serializer = ConfirmarPagoManualSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        es_staff_user = bool(
            user.is_staff
            or getattr(user, "role", None)
            in ["propietario", "superusuario", "profesional"]
        )

        preference_id = serializer.validated_data["preference_id"]
        payment_id = serializer.validated_data["payment_id"]
        motivo = serializer.validated_data.get("motivo") or "Cobro confirmado manualmente"
        reserva_manual = serializer.validated_data.get("reserva") or {}

        if PreferenciaMercadoPagoCancelada.objects.filter(preference_id=preference_id).exists():
            return Response(
                {"detail": "Esta transacción fue cancelada. Generá un nuevo pago para registrar el cobro."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pago_existente = PagoMercadoPago.objects.select_related("turno").filter(
            payment_id=payment_id,
            estado="approved",
        ).first()
        if pago_existente:
            if reserva_manual.get("aplicar_descuento_fidelizacion") and reserva_manual.get("cliente_id"):
                turno_existente = pago_existente.turno
                cliente_oferta = Cliente.objects.filter(pk=reserva_manual["cliente_id"]).first()
                turno_es_fidelizacion = turno_existente.canal_reserva == "fidelizacion" or (
                    "Oferta de cliente olvidado" in (turno_existente.notas_cliente or "")
                )
                if (
                    cliente_oferta
                    and turno_es_fidelizacion
                    and turno_existente.cliente_id != cliente_oferta.id
                ):
                    turno_existente.cliente = cliente_oferta
                    turno_existente.save(update_fields=["cliente", "updated_at"])
                    pago_existente.cliente = cliente_oferta
                    pago_existente.save(update_fields=["cliente", "actualizado_en"])
                    from apps.turnos.signals import _enviar_notificaciones_nuevo_turno

                    transaction.on_commit(
                        lambda turno_pk=turno_existente.pk: _enviar_notificaciones_nuevo_turno(turno_pk)
                    )
            if pago_existente.preference_id != preference_id:
                return Response(
                    {"detail": "Ese número de operación ya fue registrado en otra reserva."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                {"status": "approved", "turno_id": pago_existente.turno.pk},
                status=status.HTTP_200_OK,
            )

        webhook = WebhookMercadoPagoView()
        manual_payment_id = payment_id
        try:
            orden_presencial = OrdenMercadoPagoPresencial.objects.filter(
                reference_id=preference_id,
            ).first()
            if orden_presencial is not None:
                orden_payload = dict(orden_presencial.payload or {})
                es_pago_saldo_turno = orden_payload.get("tipo_movimiento") == "pago_saldo_turno"
                es_oferta_fidelizacion = bool(
                    orden_payload.get("aplicar_descuento_fidelizacion")
                    or orden_payload.get("canal_reserva") == "fidelizacion"
                )
                es_cliente_duenio = False
                if es_pago_saldo_turno and hasattr(user, "cliente_profile"):
                    es_cliente_duenio = int(orden_payload.get("cliente_id") or 0) == user.cliente_profile.id

                if not es_staff_user and not es_cliente_duenio and not es_oferta_fidelizacion:
                    return Response(
                        {"detail": "No tiene permisos para confirmar cobros presenciales."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                orden_payload["metodo_pago"] = "mercadopago_manual"
                if es_staff_user:
                    orden_payload["staff_user_id"] = user.pk
                orden_presencial.payload = orden_payload
                orden_presencial.save(update_fields=["payload", "actualizado_en"])
                webhook._crear_turno_desde_orden_presencial(
                    orden_presencial,
                    manual_payment_id,
                    monto_cobrado_override=float(orden_presencial.monto or 0),
                )
            else:
                try:
                    preferencia = services.obtener_preferencia(preference_id)
                except ValueError as exc:
                    if not reserva_manual:
                        raise
                    logger.warning(
                        "Confirmar cobro manual: MP no devolvió preferencia %s, usando reserva local: %s",
                        preference_id,
                        exc,
                    )
                    preferencia = {}

                turno_payload = webhook._parse_turno_payload(
                    preferencia.get("external_reference", "")
                )
                if turno_payload is None:
                    turno_payload, error_response = self._payload_reserva_manual(
                        user,
                        reserva_manual,
                        preferencia,
                    )
                    if error_response is not None:
                        return error_response
                    if turno_payload is None:
                        return Response(
                            {"detail": "No se pudo resolver la reserva asociada a esta preferencia."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                if not es_staff_user:
                    cliente_profile = getattr(user, "cliente_profile", None)
                    cliente_id = turno_payload.get("cliente_id")
                    es_oferta_fidelizacion = bool(
                        turno_payload.get("aplicar_descuento_fidelizacion")
                        or turno_payload.get("canal_reserva") == "fidelizacion"
                    )
                    if (
                        not es_oferta_fidelizacion
                        and (not cliente_profile or int(cliente_id or 0) != cliente_profile.id)
                    ):
                        return Response(
                            {"detail": "No tiene permisos para confirmar este cobro."},
                            status=status.HTTP_403_FORBIDDEN,
                        )

                turno_payload["metodo_pago"] = "mercadopago_manual"
                monto_cobrado = float(
                    turno_payload.get("monto_cobrado")
                    or 0
                )
                if turno_payload.get("tipo_movimiento") == "reprogramacion_turno":
                    webhook._reprogramar_turno_desde_payload(
                        turno_payload,
                        manual_payment_id,
                        preference_id,
                        monto_cobrado_override=monto_cobrado or None,
                    )
                else:
                    webhook._crear_turno_desde_payload(
                        turno_payload,
                        manual_payment_id,
                        preference_id,
                        monto_cobrado_override=monto_cobrado or None,
                    )
        except ValueError as exc:
            logger.warning("Confirmar cobro manual: no se pudo resolver preference_id=%s: %s", preference_id, exc)
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.error(
                "Confirmar cobro manual: error preference_id=%s payment_id=%s motivo=%s: %s",
                preference_id,
                payment_id,
                motivo,
                exc,
            )
            return Response(
                {"detail": "No se pudo registrar el cobro manual en el sistema."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pago = PagoMercadoPago.objects.select_related("turno").filter(
            preference_id=preference_id,
            estado="approved",
        ).order_by("-actualizado_en").first()
        if not pago:
            return Response(
                {"detail": "El cobro fue procesado, pero no se encontró el turno creado."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if manual_payment_id and pago.payment_id != manual_payment_id:
            pago.payment_id = manual_payment_id
            pago.save(update_fields=["payment_id", "actualizado_en"])

        logger.info(
            "Cobro manual confirmado preference_id=%s turno=%s payment_id=%s usuario=%s motivo=%s",
            preference_id,
            pago.turno_id,
            payment_id,
            user.pk,
            motivo,
        )
        return Response(
            {"status": "approved", "turno_id": pago.turno.pk, "payment_id": pago.payment_id},
            status=status.HTTP_200_OK,
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

    def _crear_turno_desde_orden_presencial(
        self,
        orden: OrdenMercadoPagoPresencial,
        payment_id: str,
        monto_cobrado_override: float | None = None,
    ) -> None:
        """Crea turno/pago a partir de una orden QR presencial persistida."""
        if orden.estado == "approved":
            return
        self._crear_turno_desde_payload(
            orden.payload,
            payment_id,
            orden.reference_id,
            monto_cobrado_override=monto_cobrado_override,
        )
        orden.estado = "approved"
        orden.payment_id = str(payment_id)
        orden.save(update_fields=["estado", "payment_id", "actualizado_en"])

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
        if turno_payload.get("tipo_movimiento") == "pago_saldo_turno":
            self._registrar_pago_saldo_turno_desde_payload(
                turno_payload,
                payment_id,
                mp_preference_id,
                monto_cobrado_override=monto_cobrado_override,
            )
            return

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
        precio_total_final_wh = Decimal(
            str(turno_payload.get("precio_total_final") or servicio_wh.precio or 0)
        )

        # Monto ya abonado por el cliente al momento de crear el turno.
        # Incluye tanto el pago vía MP como los créditos de billetera aplicados.
        senia_total = monto_cobrado + max(creditos_wh, Decimal("0"))

        canal_reserva = turno_payload.get("canal_reserva")
        metodo_pago = turno_payload.get("metodo_pago") or "mercadopago"
        tipo_pago = (turno_payload.get("tipo_pago") or "").upper()
        if tipo_pago not in {"SENIA", "PAGO_COMPLETO", "SIN_PAGO"}:
            usar_sena_payload = bool(turno_payload.get("usar_sena", True))
            tipo_pago = "SENIA" if usar_sena_payload else "PAGO_COMPLETO"
        es_cliente_registrado_payload = turno_payload.get("es_cliente_registrado")
        walkin_nombre = turno_payload.get("walkin_nombre") or ""
        walkin_dni = turno_payload.get("walkin_dni") or ""
        walkin_email = turno_payload.get("walkin_email") or ""
        walkin_telefono = turno_payload.get("walkin_telefono") or ""

        with transaction.atomic():
            cliente_wh, cliente_existia = _resolver_o_crear_cliente_staff_desde_payload(turno_payload)
            es_cliente_registrado = bool(
                cliente_existia
                if es_cliente_registrado_payload is None
                else es_cliente_registrado_payload
            )

            # Idempotente sobre el slot único (empleado + fecha_hora).
            # Solo reutilizamos el turno si pertenece al mismo cliente. Para
            # ofertas de fidelización, corregimos datos mal asociados por
            # intentos previos del flujo de diagnóstico.
            turno_wh = Turno.objects.filter(
                empleado=empleado_wh,
                fecha_hora=fecha_hora_wh,
            ).first()
            turno_creado = False
            turno_corregido_cliente = False
            if turno_wh is not None and turno_wh.cliente_id != cliente_wh.id:
                es_oferta_fidelizacion = canal_reserva == "fidelizacion" or bool(
                    turno_payload.get("aplicar_descuento_fidelizacion")
                )
                turno_es_fidelizacion = turno_wh.canal_reserva == "fidelizacion" or (
                    "Oferta de cliente olvidado" in (turno_wh.notas_cliente or "")
                )
                if es_oferta_fidelizacion and not turno_es_fidelizacion:
                    from apps.emails.tasks import _buscar_proximo_horario_disponible

                    fecha_recalculada = _buscar_proximo_horario_disponible(
                        empleado_wh, servicio_wh
                    )
                    if not fecha_recalculada:
                        raise ValueError(
                            "El horario sugerido ya está ocupado y no hay otro hueco disponible."
                        )
                    fecha_hora_wh = fecha_recalculada
                    turno_payload["fecha_hora"] = fecha_hora_wh.isoformat()
                    turno_wh = Turno.objects.filter(
                        empleado=empleado_wh,
                        fecha_hora=fecha_hora_wh,
                    ).first()
                elif not es_oferta_fidelizacion:
                    raise ValueError(
                        "El horario sugerido ya está ocupado por otro cliente. Generá una nueva oferta."
                    )

                if turno_wh is not None and turno_wh.cliente_id != cliente_wh.id:
                    turno_wh.cliente = cliente_wh
                    turno_wh.servicio = servicio_wh
                    turno_wh.notas_cliente = turno_payload.get("notas_cliente", "") or ""
                    turno_wh.estado = "confirmado"
                    turno_wh.precio_final = precio_total_final_wh
                    turno_wh.senia_pagada = max(Decimal("0"), senia_total)
                    turno_wh.canal_reserva = canal_reserva
                    turno_wh.metodo_pago = metodo_pago
                    turno_wh.tipo_pago = tipo_pago
                    turno_wh.save(
                        update_fields=[
                            "cliente",
                            "servicio",
                            "notas_cliente",
                            "estado",
                            "precio_final",
                            "senia_pagada",
                            "canal_reserva",
                            "metodo_pago",
                            "tipo_pago",
                            "updated_at",
                        ]
                    )
                    turno_corregido_cliente = True

            if turno_wh is None:
                turno_wh = Turno.objects.create(
                    empleado=empleado_wh,
                    fecha_hora=fecha_hora_wh,
                    cliente=cliente_wh,
                    servicio=servicio_wh,
                    notas_cliente=turno_payload.get("notas_cliente", "") or "",
                    estado="confirmado",
                    precio_final=precio_total_final_wh,
                    senia_pagada=max(Decimal("0"), senia_total),
                    canal_reserva=canal_reserva,
                    metodo_pago=metodo_pago,
                    tipo_pago=tipo_pago,
                    es_cliente_registrado=es_cliente_registrado,
                    walkin_nombre=walkin_nombre or None,
                    walkin_dni=walkin_dni or None,
                    walkin_email=walkin_email or None,
                    walkin_telefono=walkin_telefono or None,
                )
                turno_creado = True
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

            _mark_streak_coupon_used(turno_payload.get("streak_coupon_id"), turno_wh)

            pago_por_preference = PagoMercadoPago.objects.filter(
                preference_id=mp_preference_id
            ).first()
            if pago_por_preference is not None:
                if pago_por_preference.estado != "approved":
                    pago_por_preference.estado = "approved"
                    pago_por_preference.payment_id = str(payment_id)
                    pago_por_preference.save(
                        update_fields=["estado", "payment_id", "actualizado_en"]
                    )
                    from apps.turnos.signals import _enviar_notificaciones_nuevo_turno

                    _enviar_notificaciones_nuevo_turno(turno_wh.pk)
                else:
                    logger.info(
                        "Webhook MP: PagoMercadoPago ya registrado preference_id=%s, ignorando.",
                        mp_preference_id,
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

            if turno_corregido_cliente:
                from apps.turnos.signals import _enviar_notificaciones_nuevo_turno

                transaction.on_commit(
                    lambda turno_pk=turno_wh.pk: _enviar_notificaciones_nuevo_turno(turno_pk)
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

    def _registrar_pago_saldo_turno_desde_payload(
        self,
        payload: dict,
        payment_id: str,
        mp_preference_id: str,
        monto_cobrado_override: float | None = None,
    ) -> None:
        """Registra un pago MP/manual sobre un turno existente sin crear otro turno."""
        if not mp_preference_id:
            logger.warning("Pago saldo turno sin preference_id para payment_id=%s", payment_id)
            return

        pago_por_preference = PagoMercadoPago.objects.filter(
            preference_id=mp_preference_id
        ).first()
        if pago_por_preference is not None and pago_por_preference.estado == "approved":
            return

        turno = Turno.objects.select_related("cliente", "servicio").get(pk=payload["turno_id"])
        monto_cobrado = Decimal(
            str(monto_cobrado_override or payload.get("monto_cobrado") or 0)
        )
        if monto_cobrado <= Decimal("0.00"):
            raise ValueError("El monto cobrado debe ser mayor a cero.")

        metodo_pago_turno = "mercadopago_qr"
        metodo_payload = payload.get("metodo_pago") or "mercadopago_qr"
        staff_user = None
        staff_user_id = payload.get("staff_user_id")
        if staff_user_id:
            try:
                from apps.users.models import User

                staff_user = User.objects.filter(pk=staff_user_id).first()
            except Exception:
                staff_user = None

        with transaction.atomic():
            if pago_por_preference is not None:
                pago_por_preference.estado = "approved"
                pago_por_preference.payment_id = str(payment_id)
                pago_por_preference.monto = monto_cobrado
                pago_por_preference.save(
                    update_fields=["estado", "payment_id", "monto", "actualizado_en"]
                )
            else:
                PagoMercadoPago.objects.create(
                    preference_id=mp_preference_id,
                    turno=turno,
                    cliente=turno.cliente,
                    payment_id=str(payment_id),
                    init_point="",
                    monto=monto_cobrado,
                    moneda=settings.MP_CURRENCY_ID,
                    descripcion=f"Saldo turno #{turno.pk} — {turno.servicio.nombre}",
                    estado="approved",
                )

            senia_actual = Decimal(turno.senia_pagada or 0)
            turno.senia_pagada = senia_actual + monto_cobrado
            turno.metodo_pago = metodo_pago_turno
            turno.fecha_pago_registrado = timezone.now()
            if calcular_monto_pendiente_turno(turno) <= Decimal("0.00"):
                turno.tipo_pago = "PAGO_COMPLETO"
            elif not turno.tipo_pago:
                turno.tipo_pago = "SENIA"
            turno.save(
                update_fields=[
                    "senia_pagada",
                    "metodo_pago",
                    "fecha_pago_registrado",
                    "tipo_pago",
                    "updated_at",
                ]
            )

            if staff_user is not None:
                from apps.turnos.models import HistorialTurno

                HistorialTurno.objects.create(
                    turno=turno,
                    usuario=staff_user,
                    accion="Pago registrado manualmente" if metodo_payload == "mercadopago_manual" else "Pago Mercado Pago registrado",
                    estado_anterior=turno.estado,
                    estado_nuevo=turno.estado,
                    observaciones=(
                        f"Cobro de saldo registrado por {metodo_payload}. "
                        f"Monto: {monto_cobrado}. Operacion: {payment_id}."
                    ),
                )

    def _reprogramar_turno_desde_payload(
        self,
        payload: dict,
        payment_id: str,
        mp_preference_id: str,
        monto_cobrado_override: float | None = None,
    ) -> None:
        """Aplica una reprogramación ya pagada por Mercado Pago."""
        if not mp_preference_id:
            logger.warning(
                "Webhook MP reprogramación: preference_id vacío para payment_id=%s.",
                payment_id,
            )
            return

        if PreferenciaMercadoPagoCancelada.objects.filter(preference_id=mp_preference_id).exists():
            logger.info(
                "Webhook MP: preference_id=%s cancelada desde panel, se ignora el pago tardío.",
                mp_preference_id,
            )
            return

        pago = PagoMercadoPago.objects.filter(preference_id=mp_preference_id).first()
        if pago and pago.estado == "approved":
            logger.info(
                "Webhook MP reprogramación: pago ya aprobado preference_id=%s, ignorando.",
                mp_preference_id,
            )
            return

        turno = Turno.objects.select_related("cliente", "servicio", "empleado").get(
            pk=payload["turno_id"]
        )
        nueva_fecha_hora = parse_datetime(payload["nueva_fecha_hora"])
        if nueva_fecha_hora is None:
            raise ValueError("Fecha de reprogramación inválida")
        if timezone.is_naive(nueva_fecha_hora):
            nueva_fecha_hora = timezone.make_aware(nueva_fecha_hora, timezone.get_current_timezone())

        tipo_pago = (payload.get("tipo_pago") or "SENIA").upper()
        if tipo_pago not in {"SENIA", "PAGO_COMPLETO"}:
            tipo_pago = "SENIA"

        monto_cobrado = Decimal(
            str(monto_cobrado_override or payload.get("monto_cobrado") or 0)
        )

        with transaction.atomic():
            resultado = reprogramar_turno(
                turno=turno,
                usuario=turno.cliente.user,
                fecha_hora_nueva=nueva_fecha_hora,
                nuevo_empleado_id=payload.get("empleado_id") or None,
                aceptar_penalidad_fuera_rango=True,
                motivo=payload.get("motivo") or "Reprogramación abonada por Mercado Pago",
                reiniciar_pago_cliente=False,
            )

            turno = resultado.turno
            turno.senia_pagada = monto_cobrado
            turno.tipo_pago = tipo_pago
            turno.metodo_pago = payload.get("metodo_pago") or "mercadopago"
            turno.fecha_pago_registrado = timezone.now()
            turno.estado = "confirmado"
            turno.save(
                update_fields=[
                    "senia_pagada",
                    "tipo_pago",
                    "metodo_pago",
                    "fecha_pago_registrado",
                    "estado",
                    "updated_at",
                ]
            )

            if pago is None:
                pago = PagoMercadoPago.objects.create(
                    preference_id=mp_preference_id,
                    turno=turno,
                    cliente=turno.cliente,
                    init_point="",
                    monto=monto_cobrado,
                    moneda=settings.MP_CURRENCY_ID,
                    descripcion=f"Reprogramación turno #{turno.pk} — {turno.servicio.nombre}",
                    estado="pending",
                )

            pago.turno = turno
            pago.cliente = turno.cliente
            pago.payment_id = str(payment_id)
            pago.monto = monto_cobrado
            pago.estado = "approved"
            pago.save(
                update_fields=[
                    "turno",
                    "cliente",
                    "payment_id",
                    "monto",
                    "estado",
                    "actualizado_en",
                ]
            )

        logger.info(
            "Webhook MP reprogramación: turno=%s reprogramado y pago aprobado preference_id=%s",
            turno.pk,
            mp_preference_id,
        )

    def _parse_turno_payload(self, external_reference: str) -> dict | None:
        """Intenta parsear el external_reference como JSON. Devuelve None si no es el nuevo flujo."""
        try:
            parsed = json.loads(external_reference)
            if isinstance(parsed, dict) and (
                "cliente_id" in parsed
                or parsed.get("tipo_movimiento") in {"reprogramacion_turno", "pago_saldo_turno"}
            ):
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
                logger.warning(
                    "Webhook MP: no se pudo obtener pago %s con credenciales generales: %s. Reintentando QR.",
                    resource_id,
                    exc,
                )
                try:
                    pago_mp = services.obtener_pago(str(resource_id), use_qr_credentials=True)
                except ValueError as exc_qr:
                    logger.error(
                        "Webhook MP: no se pudo obtener pago %s con credenciales QR: %s",
                        resource_id,
                        exc_qr,
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

            orden_presencial = OrdenMercadoPagoPresencial.objects.filter(
                reference_id=external_reference,
                estado="pending",
            ).first()
            if orden_presencial is not None:
                if nuevo_estado == "approved":
                    try:
                        self._crear_turno_desde_orden_presencial(
                            orden_presencial,
                            str(resource_id),
                            monto_cobrado_override=float(pago_mp.get("transaction_amount") or orden_presencial.monto or 0),
                        )
                    except Exception as exc:
                        logger.error("Webhook MP orden QR presencial: error procesando pago: %s", exc)
                return Response({"detail": "Webhook procesado."}, status=status.HTTP_200_OK)

            turno_payload = self._parse_turno_payload(external_reference)

            if turno_payload is not None:
                # ── nuevo flujo ──
                if nuevo_estado == "approved":
                    try:
                        if turno_payload.get("tipo_movimiento") == "reprogramacion_turno":
                            self._reprogramar_turno_desde_payload(
                                turno_payload, resource_id, mp_preference_id
                            )
                        else:
                            self._crear_turno_desde_payload(
                                turno_payload, resource_id, mp_preference_id
                            )
                    except Exception as exc:
                        logger.error(
                            "Webhook MP (payment): error procesando pago: %s", exc
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
                    pago = (
                        PagoMercadoPago.objects.filter(turno_id=turno_id_clasico)
                        .order_by("-creado_en")
                        .first()
                    )
                    if not pago:
                        raise PagoMercadoPago.DoesNotExist
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
                logger.warning(
                    "Webhook MP: no se pudo obtener orden %s con credenciales generales: %s. Reintentando QR.",
                    resource_id,
                    exc,
                )
                try:
                    orden = services.obtener_orden(str(resource_id), use_qr_credentials=True)
                except ValueError as exc_qr:
                    logger.error(
                        "Webhook MP: no se pudo obtener orden %s con credenciales QR: %s",
                        resource_id,
                        exc_qr,
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

            orden_presencial = OrdenMercadoPagoPresencial.objects.filter(
                reference_id=external_reference,
                estado="pending",
            ).first()
            if orden_presencial is not None:
                pago_aprobado = next(
                    (p for p in pagos_orden if p.get("status") == "approved"), None
                )
                if pago_aprobado:
                    payment_id_aprobado = pago_aprobado.get("id", resource_id)
                    monto_cobrado = float(
                        pago_aprobado.get("total_paid_amount")
                        or pago_aprobado.get("transaction_amount")
                        or orden_presencial.monto
                        or 0
                    )
                    try:
                        self._crear_turno_desde_orden_presencial(
                            orden_presencial,
                            str(payment_id_aprobado),
                            monto_cobrado_override=monto_cobrado or None,
                        )
                    except Exception as exc:
                        logger.error(
                            "Webhook merchant_order QR presencial: error procesando pago: %s",
                            exc,
                        )
                else:
                    logger.info(
                        "Webhook merchant_order QR presencial: ningún pago aprobado aún (estados=%s).",
                        [p.get("status") for p in pagos_orden],
                    )
                return Response(status=status.HTTP_200_OK)

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
                    if turno_payload.get("tipo_movimiento") == "reprogramacion_turno":
                        self._reprogramar_turno_desde_payload(
                            turno_payload,
                            payment_id_aprobado,
                            mp_preference_id,
                            monto_cobrado_override=monto_cobrado or None,
                        )
                    else:
                        self._crear_turno_desde_payload(
                            turno_payload,
                            payment_id_aprobado,
                            mp_preference_id,
                            monto_cobrado_override=monto_cobrado or None,
                        )
                except Exception as exc:
                    logger.error(
                        "Webhook MP (merchant_order): error procesando pago: %s", exc
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
            pago = PagoMercadoPago.objects.select_related("turno").filter(
                preference_id=preference_id,
                estado="approved",
            ).order_by("-actualizado_en").first()
            if not pago:
                raise PagoMercadoPago.DoesNotExist
            return Response(
                {"status": "approved", "turno_id": pago.turno.pk, "payment_id": pago.payment_id},
                status=status.HTTP_200_OK,
            )
        except PagoMercadoPago.DoesNotExist:
            orden_presencial = OrdenMercadoPagoPresencial.objects.filter(
                reference_id=preference_id
            ).first()
            if orden_presencial is not None:
                if orden_presencial.estado == "approved":
                    pago = PagoMercadoPago.objects.select_related("turno").filter(
                        preference_id=preference_id,
                        estado="approved",
                    ).first()
                    if pago:
                        return Response(
                            {"status": "approved", "turno_id": pago.turno.pk, "payment_id": pago.payment_id},
                            status=status.HTTP_200_OK,
                        )
                if PreferenciaMercadoPagoCancelada.objects.filter(preference_id=preference_id).exists():
                    return Response({"status": "cancelled"}, status=status.HTTP_200_OK)
                try:
                    pago_mp = services.buscar_pago_aprobado_por_external_reference(
                        preference_id,
                        use_qr_credentials=True,
                    )
                except ValueError as exc:
                    logger.warning(
                        "VerificarPago QR presencial fallback MP falló para reference_id=%s: %s",
                        preference_id,
                        exc,
                    )
                    return Response({"status": "pending"}, status=status.HTTP_200_OK)
                if not pago_mp:
                    try:
                        orden_mp = services.buscar_orden_aprobada_por_external_reference(
                            preference_id,
                            use_qr_credentials=True,
                        )
                    except ValueError as exc:
                        logger.warning(
                            "VerificarPago QR presencial merchant_order fallback falló para reference_id=%s: %s",
                            preference_id,
                            exc,
                        )
                        return Response({"status": "pending"}, status=status.HTTP_200_OK)

                    if not orden_mp:
                        return Response({"status": "pending"}, status=status.HTTP_200_OK)

                    pago_aprobado = next(
                        (p for p in orden_mp.get("payments", []) if p.get("status") == "approved"),
                        None,
                    )
                    if not pago_aprobado:
                        return Response({"status": "pending"}, status=status.HTTP_200_OK)

                    payment_id = str(pago_aprobado.get("id") or "")
                    monto_cobrado = float(
                        pago_aprobado.get("total_paid_amount")
                        or pago_aprobado.get("transaction_amount")
                        or orden_presencial.monto
                        or 0
                    )
                    try:
                        WebhookMercadoPagoView()._crear_turno_desde_orden_presencial(
                            orden_presencial,
                            payment_id,
                            monto_cobrado_override=monto_cobrado or None,
                        )
                    except Exception as exc:
                        logger.error(
                            "VerificarPago QR presencial merchant_order: error registrando pago/turno reference_id=%s: %s",
                            preference_id,
                            exc,
                        )
                        return Response({"status": "pending"}, status=status.HTTP_200_OK)

                    pago = PagoMercadoPago.objects.select_related("turno").filter(
                        preference_id=preference_id,
                        estado="approved",
                    ).first()
                    if pago:
                        return Response(
                            {"status": "approved", "turno_id": pago.turno.pk, "payment_id": pago.payment_id},
                            status=status.HTTP_200_OK,
                        )
                    return Response({"status": "pending"}, status=status.HTTP_200_OK)

                payment_id = str(pago_mp.get("id") or "")
                monto_cobrado = float(
                    pago_mp.get("transaction_amount") or orden_presencial.monto or 0
                )
                try:
                    WebhookMercadoPagoView()._crear_turno_desde_orden_presencial(
                        orden_presencial,
                        payment_id,
                        monto_cobrado_override=monto_cobrado or None,
                    )
                except Exception as exc:
                    logger.error(
                        "VerificarPago QR presencial: error registrando pago/turno reference_id=%s: %s",
                        preference_id,
                        exc,
                    )
                    return Response({"status": "pending"}, status=status.HTTP_200_OK)

                pago = PagoMercadoPago.objects.select_related("turno").filter(
                    preference_id=preference_id,
                    estado="approved",
                ).first()
                if pago:
                    return Response(
                        {"status": "approved", "turno_id": pago.turno.pk, "payment_id": pago.payment_id},
                        status=status.HTTP_200_OK,
                    )
                return Response({"status": "pending"}, status=status.HTTP_200_OK)

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
                return Response(
                    {"status": "pending", "detail": str(exc)},
                    status=status.HTTP_200_OK,
                )

            if not pago_mp:
                try:
                    ultimo_pago = services.buscar_ultimo_pago_por_preference(preference_id)
                except ValueError as exc:
                    logger.warning(
                        "VerificarPago último pago MP falló para preference_id=%s: %s",
                        preference_id,
                        exc,
                    )
                    return Response(
                        {"status": "pending"},
                        status=status.HTTP_200_OK,
                    )

                if ultimo_pago:
                    estado_mp = ultimo_pago.get("status") or "pending"
                    detalle_mp = ultimo_pago.get("status_detail") or ""
                    if estado_mp in {"rejected", "cancelled", "refunded", "charged_back"}:
                        return Response(
                            {
                                "status": "rejected",
                                "mp_status": estado_mp,
                                "mp_status_detail": detalle_mp,
                                "payment_id": ultimo_pago.get("id"),
                            },
                            status=status.HTTP_200_OK,
                        )
                    return Response(
                        {
                            "status": "pending",
                            "mp_status": estado_mp,
                            "mp_status_detail": detalle_mp,
                            "payment_id": ultimo_pago.get("id"),
                        },
                        status=status.HTTP_200_OK,
                    )

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
                webhook = WebhookMercadoPagoView()
                if turno_payload.get("tipo_movimiento") == "reprogramacion_turno":
                    webhook._reprogramar_turno_desde_payload(
                        turno_payload,
                        payment_id,
                        preference_id,
                        monto_cobrado_override=monto_cobrado or None,
                    )
                else:
                    webhook._crear_turno_desde_payload(
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
                    {"status": "approved", "turno_id": pago.turno.pk, "payment_id": pago.payment_id},
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
