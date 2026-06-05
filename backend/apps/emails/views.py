from decimal import Decimal, ROUND_HALF_UP
import json

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.shortcuts import get_object_or_404, redirect
from django.conf import settings
from django.contrib.auth import login as django_login
from django.db import transaction
from django.utils import timezone
from rest_framework.authtoken.models import Token as DRFToken
from rest_framework.views import APIView

from apps.clientes.models import Billetera
from apps.mercadopago import services as mp_services
from apps.mercadopago.models import PagoMercadoPago
from apps.turnos.models import Turno
from .models import Notificacion, NotificacionConfig, AccessToken, PromotionOffer
from .serializers import NotificacionSerializer, NotificacionConfigSerializer


def _slot_turno_disponible(empleado, servicio, fecha_hora) -> bool:
    if not fecha_hora or fecha_hora <= timezone.now():
        return False

    from datetime import timedelta

    hora_fin = fecha_hora + timedelta(minutes=servicio.duracion_minutos)
    turnos_dia = Turno.objects.select_related("servicio").filter(
        empleado=empleado,
        fecha_hora__date=fecha_hora.date(),
        estado__in=["pendiente", "confirmado", "en_proceso", "oferta_enviada"],
    )
    for turno in turnos_dia:
        if not turno.fecha_hora or not turno.servicio:
            continue
        inicio = turno.fecha_hora
        fin = inicio + timedelta(minutes=turno.servicio.duracion_minutos)
        if fecha_hora < fin and hora_fin > inicio:
            return False
    return True


def _precio_promocional(offer: PromotionOffer) -> tuple[Decimal, Decimal, Decimal]:
    precio_original = Decimal(str(offer.servicio.precio or 0))
    precio_final = precio_original
    descuento = Decimal("0.00")

    if offer.beneficio == PromotionOffer.Benefit.DISCOUNT:
        from apps.authentication.models import ConfiguracionGlobal

        descuento_monto = Decimal(str(getattr(offer.servicio, "descuento_fidelizacion_monto", None) or 0))
        descuento_pct = Decimal(str(getattr(offer.servicio, "descuento_fidelizacion_pct", None) or 0))
        if descuento_monto > 0:
            precio_final = max(Decimal("0.00"), precio_original - descuento_monto)
        elif descuento_pct > 0:
            precio_final = (precio_original * (Decimal("100") - descuento_pct) / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        else:
            config = ConfiguracionGlobal.get_config()
            global_pct = Decimal(str(getattr(config, "descuento_fidelizacion_pct", 0) or 0))
            if global_pct > 0:
                precio_final = (precio_original * (Decimal("100") - global_pct) / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        descuento = max(Decimal("0.00"), precio_original - precio_final)

    return precio_original, precio_final, descuento


def _senia_sugerida(servicio, precio_final: Decimal) -> Decimal:
    monto_sena_fijo = Decimal(str(getattr(servicio, "monto_sena_fijo", 0) or 0))
    if monto_sena_fijo > 0:
        return min(monto_sena_fijo, precio_final).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return (precio_final / Decimal("2")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _wallet_balance(cliente) -> Decimal:
    try:
        return Decimal(cliente.billetera.saldo or 0)
    except Exception:
        return Decimal("0.00")


def _serialize_offer(offer: PromotionOffer) -> dict:
    precio_original, precio_final, descuento = _precio_promocional(offer)
    senia = _senia_sugerida(offer.servicio, precio_final)
    saldo = _wallet_balance(offer.cliente)
    campaign_taken = PromotionOffer.objects.filter(
        campaign_id=offer.campaign_id,
        status__in=[PromotionOffer.Status.ACCEPTED, PromotionOffer.Status.PAYMENT_PENDING],
    ).exclude(pk=offer.pk).exists()

    estado = offer.status
    if offer.status == PromotionOffer.Status.SENT and offer.is_expired:
        estado = PromotionOffer.Status.EXPIRED
    elif offer.status == PromotionOffer.Status.SENT and campaign_taken:
        estado = PromotionOffer.Status.TAKEN_BY_OTHER

    return {
        "token": str(offer.token),
        "status": estado,
        "beneficio": offer.beneficio,
        "expires_at": offer.expires_at.isoformat(),
        "cliente": {"nombre": offer.cliente.nombre_completo},
        "servicio": {
            "id": offer.servicio_id,
            "nombre": offer.servicio.nombre,
            "duracion_minutos": offer.servicio.duracion_minutos,
        },
        "empleado": {"id": offer.empleado_id, "nombre": offer.empleado.nombre_completo},
        "fecha_hora": offer.fecha_hora.isoformat(),
        "precios": {
            "original": str(precio_original),
            "final": str(precio_final),
            "descuento": str(descuento),
            "senia": str(senia),
            "saldo_billetera": str(saldo),
        },
        "turno_id": offer.turno_id,
        "payment_preference_id": offer.payment_preference_id,
    }


def _mark_campaign_taken(offer: PromotionOffer) -> None:
    PromotionOffer.objects.filter(
        campaign_id=offer.campaign_id,
        status=PromotionOffer.Status.SENT,
    ).exclude(pk=offer.pk).update(status=PromotionOffer.Status.TAKEN_BY_OTHER)


def _lock_offer_or_error(token_slug):
    offer = (
        PromotionOffer.objects.select_for_update()
        .select_related("cliente__user", "servicio", "empleado__user", "turno")
        .filter(token=token_slug)
        .first()
    )
    if not offer:
        return None, Response({"status": "token_invalido", "detail": "Oferta no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    list(PromotionOffer.objects.select_for_update().filter(campaign_id=offer.campaign_id))

    if offer.status in [PromotionOffer.Status.ACCEPTED, PromotionOffer.Status.PAYMENT_PENDING]:
        return offer, None
    if offer.status == PromotionOffer.Status.TAKEN_BY_OTHER:
        return None, Response({"status": "tomada_por_otro", "detail": "Esta oferta ya fue tomada por otro cliente."}, status=status.HTTP_409_CONFLICT)
    if offer.status != PromotionOffer.Status.SENT:
        return None, Response({"status": offer.status, "detail": "Esta oferta ya no está disponible."}, status=status.HTTP_410_GONE)
    if offer.is_expired:
        offer.status = PromotionOffer.Status.EXPIRED
        offer.save(update_fields=["status", "updated_at"])
        return None, Response({"status": "expirada", "detail": "Esta oferta ya no está disponible."}, status=status.HTTP_410_GONE)

    if PromotionOffer.objects.filter(
        campaign_id=offer.campaign_id,
        status__in=[PromotionOffer.Status.ACCEPTED, PromotionOffer.Status.PAYMENT_PENDING],
    ).exclude(pk=offer.pk).exists():
        offer.status = PromotionOffer.Status.TAKEN_BY_OTHER
        offer.save(update_fields=["status", "updated_at"])
        return None, Response({"status": "tomada_por_otro", "detail": "Esta oferta ya fue tomada por otro cliente."}, status=status.HTTP_409_CONFLICT)

    if not _slot_turno_disponible(offer.empleado, offer.servicio, offer.fecha_hora):
        offer.status = PromotionOffer.Status.TAKEN_BY_OTHER
        offer.save(update_fields=["status", "updated_at"])
        return None, Response({"status": "tomada_por_otro", "detail": "Esta oferta ya fue tomada por otro cliente."}, status=status.HTTP_409_CONFLICT)

    return offer, None


def _finalize_paid_offer(offer: PromotionOffer, payment_id: str, forced: bool = False) -> PromotionOffer:
    precio_original, precio_final, _ = _precio_promocional(offer)
    tipo_pago = (offer.payment_tipo_pago or "SENIA").upper()
    if tipo_pago not in {"SENIA", "PAGO_COMPLETO"}:
        tipo_pago = "SENIA"

    monto_base = _senia_sugerida(offer.servicio, precio_final) if tipo_pago == "SENIA" else precio_final
    creditos_aplicados = Decimal(offer.payment_creditos_aplicados or 0)
    monto_mp = Decimal(offer.payment_monto_mp or 0)

    if offer.turno_id and offer.status == PromotionOffer.Status.ACCEPTED:
        return offer

    turno = Turno.objects.create(
        cliente=offer.cliente,
        servicio=offer.servicio,
        empleado=offer.empleado,
        fecha_hora=offer.fecha_hora,
        estado="confirmado",
        precio_final=precio_final,
        senia_pagada=monto_base,
        tipo_pago=tipo_pago,
        canal_reserva="fidelizacion",
        metodo_pago="mixto" if creditos_aplicados > 0 and monto_mp > 0 else "mercadopago",
        notas_cliente=(
            "Oferta promocional con saldo de billetera aplicada."
            + (" Pago forzado manualmente desde pantalla de promoción." if forced else "")
        ),
    )

    if creditos_aplicados > 0:
        offer.cliente.billetera.descontar_saldo(
            creditos_aplicados,
            motivo=f"Reserva promoción — {offer.servicio.nombre}",
        )

    if monto_mp > 0:
        PagoMercadoPago.objects.get_or_create(
            preference_id=offer.payment_preference_id,
            defaults={
                "turno": turno,
                "cliente": offer.cliente,
                "payment_id": payment_id,
                "init_point": "",
                "monto": monto_mp,
                "moneda": getattr(settings, "MP_CURRENCY_ID", "ARS"),
                "descripcion": f"Turno #{turno.pk} — {offer.servicio.nombre}",
                "estado": "approved",
            },
        )

    offer.status = PromotionOffer.Status.ACCEPTED
    offer.turno = turno
    offer.accepted_at = timezone.now()
    offer.save(update_fields=["status", "turno", "accepted_at", "updated_at"])
    _mark_campaign_taken(offer)
    return offer


class NotificacionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para notificaciones
    - list: Obtener todas las notificaciones del usuario
    - retrieve: Obtener una notificación específica
    - marcar_leida: Marcar una notificación como leída
    - marcar_todas_leidas: Marcar todas las notificaciones como leídas
    - no_leidas: Obtener solo las notificaciones no leídas
    """

    serializer_class = NotificacionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Solo retorna las notificaciones del usuario autenticado"""
        return Notificacion.objects.filter(usuario=self.request.user)

    @action(detail=True, methods=["post"])
    def marcar_leida(self, request, pk=None):
        """Marca una notificación como leída"""
        notificacion = self.get_object()
        notificacion.marcar_leida()
        serializer = self.get_serializer(notificacion)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def marcar_todas_leidas(self, request):
        """Marca todas las notificaciones no leídas como leídas"""
        notificaciones = self.get_queryset().filter(leida=False)
        count = notificaciones.count()

        for notificacion in notificaciones:
            notificacion.marcar_leida()

        return Response(
            {"message": f"{count} notificaciones marcadas como leídas", "count": count}
        )

    @action(detail=False, methods=["get"])
    def no_leidas(self, request):
        """Obtiene solo las notificaciones no leídas"""
        notificaciones = self.get_queryset().filter(leida=False)
        serializer = self.get_serializer(notificaciones, many=True)
        return Response({"count": notificaciones.count(), "results": serializer.data})

    @action(detail=False, methods=["get"])
    def recientes(self, request):
        """Obtiene las últimas 10 notificaciones"""
        notificaciones = self.get_queryset()[:10]
        serializer = self.get_serializer(notificaciones, many=True)
        return Response(serializer.data)


class NotificacionConfigViewSet(viewsets.ModelViewSet):
    """
    ViewSet para configuración de notificaciones
    - retrieve: Obtener la configuración actual
    - update/partial_update: Actualizar la configuración
    """

    serializer_class = NotificacionConfigSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Solo retorna la configuración del usuario autenticado"""
        return NotificacionConfig.objects.filter(user=self.request.user)

    def get_object(self):
        """Obtiene o crea la configuración del usuario"""
        config, created = NotificacionConfig.objects.get_or_create(
            user=self.request.user
        )
        return config

    def list(self, request):
        """Retorna la configuración del usuario autenticado"""
        config = self.get_object()
        serializer = self.get_serializer(config)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        """Actualiza la configuración del usuario"""
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        """Actualización parcial de la configuración"""
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class PromotionOfferDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token_slug):
        offer = get_object_or_404(
            PromotionOffer.objects.select_related("cliente__user", "servicio", "empleado__user", "turno"),
            token=token_slug,
        )
        return Response(_serialize_offer(offer), status=status.HTTP_200_OK)


class PromotionOfferAcceptView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, token_slug):
        with transaction.atomic():
            offer, error = _lock_offer_or_error(token_slug)
            if error is not None:
                return error
            if offer.status == PromotionOffer.Status.ACCEPTED:
                return Response(_serialize_offer(offer), status=status.HTTP_200_OK)
            if offer.status == PromotionOffer.Status.PAYMENT_PENDING:
                return Response(
                    {"status": "pago_pendiente", "detail": "Esta oferta ya tiene un pago iniciado."},
                    status=status.HTTP_409_CONFLICT,
                )
            if offer.beneficio == PromotionOffer.Benefit.WALLET:
                return Response(
                    {"status": "requiere_pago", "detail": "Esta oferta requiere elegir seña o pago completo."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            _, precio_final, _ = _precio_promocional(offer)
            turno = Turno.objects.create(
                cliente=offer.cliente,
                servicio=offer.servicio,
                empleado=offer.empleado,
                fecha_hora=offer.fecha_hora,
                estado="pendiente",
                precio_final=precio_final,
                senia_pagada=Decimal("0.00"),
                tipo_pago="SIN_PAGO",
                canal_reserva="fidelizacion",
                notas_cliente="Oferta promocional aceptada desde email. Pago pendiente para el día del turno.",
            )
            offer.status = PromotionOffer.Status.ACCEPTED
            offer.accepted_at = timezone.now()
            offer.turno = turno
            offer.save(update_fields=["status", "accepted_at", "turno", "updated_at"])
            _mark_campaign_taken(offer)

        return Response(_serialize_offer(offer), status=status.HTTP_201_CREATED)


class PromotionOfferPaymentView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, token_slug):
        tipo_pago = (request.data.get("tipo_pago") or "SENIA").upper()
        if tipo_pago not in {"SENIA", "PAGO_COMPLETO"}:
            return Response({"detail": "tipo_pago inválido."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            offer, error = _lock_offer_or_error(token_slug)
            if error is not None:
                return error
            if offer.status == PromotionOffer.Status.ACCEPTED and offer.turno_id:
                return Response(_serialize_offer(offer), status=status.HTTP_200_OK)
            if offer.status == PromotionOffer.Status.PAYMENT_PENDING:
                return Response(
                    {"status": "pago_pendiente", "preference_id": offer.payment_preference_id},
                    status=status.HTTP_409_CONFLICT,
                )

            precio_original, precio_final, _ = _precio_promocional(offer)
            monto_base = _senia_sugerida(offer.servicio, precio_final) if tipo_pago == "SENIA" else precio_final
            saldo = _wallet_balance(offer.cliente)
            creditos_aplicados = min(saldo, monto_base).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            monto_mp = (monto_base - creditos_aplicados).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            notas_cliente = "Oferta promocional con saldo de billetera aplicada."

            if monto_mp <= Decimal("0.00"):
                if creditos_aplicados > 0:
                    offer.cliente.billetera.descontar_saldo(
                        creditos_aplicados,
                        motivo=f"Reserva promoción — {offer.servicio.nombre}",
                    )
                turno = Turno.objects.create(
                    cliente=offer.cliente,
                    servicio=offer.servicio,
                    empleado=offer.empleado,
                    fecha_hora=offer.fecha_hora,
                    estado="confirmado",
                    precio_final=precio_final,
                    senia_pagada=monto_base,
                    tipo_pago=tipo_pago,
                    canal_reserva="fidelizacion",
                    metodo_pago="mixto" if creditos_aplicados > 0 else "efectivo",
                    notas_cliente=notas_cliente,
                )
                offer.status = PromotionOffer.Status.ACCEPTED
                offer.accepted_at = timezone.now()
                offer.turno = turno
                offer.save(update_fields=["status", "accepted_at", "turno", "updated_at"])
                _mark_campaign_taken(offer)
                return Response({"status": "free", **_serialize_offer(offer)}, status=status.HTTP_201_CREATED)

            min_mp_amount = Decimal(str(getattr(settings, "MP_MIN_AMOUNT", 100)))
            if monto_mp < min_mp_amount:
                return Response(
                    {"detail": f"El monto a cobrar (${monto_mp}) es inferior al mínimo permitido por Mercado Pago."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            turno_payload = {
                "cliente_id": offer.cliente_id,
                "servicio_id": offer.servicio_id,
                "empleado_id": offer.empleado_id,
                "fecha_hora": offer.fecha_hora.isoformat(),
                "notas_cliente": notas_cliente,
                "usar_sena": tipo_pago == "SENIA",
                "tipo_pago": tipo_pago,
                "creditos_aplicados": str(creditos_aplicados),
                "monto_cobrado": str(monto_mp),
                "precio_total_original": str(precio_original),
                "precio_total_final": str(precio_final),
                "canal_reserva": "fidelizacion",
                "metodo_pago": "mercadopago",
                "aplicar_descuento_fidelizacion": offer.beneficio == PromotionOffer.Benefit.DISCOUNT,
                "promotion_offer_token": str(offer.token),
            }
            notification_url = getattr(settings, "MERCADO_PAGO_WEBHOOK_URL", "")
            try:
                resultado = mp_services.crear_preferencia(
                    titulo=offer.servicio.nombre,
                    descripcion=f"Turno — {offer.servicio.nombre}",
                    monto=float(monto_mp),
                    external_reference=json.dumps(turno_payload),
                    notification_url=notification_url,
                    payer_email=offer.cliente.user.email or "",
                )
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

            offer.status = PromotionOffer.Status.PAYMENT_PENDING
            offer.accepted_at = timezone.now()
            offer.payment_preference_id = resultado["preference_id"]
            offer.payment_tipo_pago = tipo_pago
            offer.payment_creditos_aplicados = creditos_aplicados
            offer.payment_monto_mp = monto_mp
            offer.save(
                update_fields=[
                    "status",
                    "accepted_at",
                    "payment_preference_id",
                    "payment_tipo_pago",
                    "payment_creditos_aplicados",
                    "payment_monto_mp",
                    "updated_at",
                ]
            )
            _mark_campaign_taken(offer)

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


class PromotionOfferForcePaymentView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, token_slug):
        with transaction.atomic():
            offer = (
                PromotionOffer.objects.select_for_update()
                .select_related("cliente__user", "servicio", "empleado__user", "turno")
                .filter(token=token_slug)
                .first()
            )
            if not offer:
                return Response(
                    {"status": "token_invalido", "detail": "Oferta no encontrada."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            list(PromotionOffer.objects.select_for_update().filter(campaign_id=offer.campaign_id))

            if offer.status == PromotionOffer.Status.ACCEPTED:
                return Response(_serialize_offer(offer), status=status.HTTP_200_OK)
            if offer.status != PromotionOffer.Status.PAYMENT_PENDING:
                return Response(
                    {"status": offer.status, "detail": "La oferta no tiene un pago pendiente para forzar."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not _slot_turno_disponible(offer.empleado, offer.servicio, offer.fecha_hora):
                offer.status = PromotionOffer.Status.TAKEN_BY_OTHER
                offer.save(update_fields=["status", "updated_at"])
                return Response(
                    {"status": "tomada_por_otro", "detail": "Esta oferta ya fue tomada por otro cliente."},
                    status=status.HTTP_409_CONFLICT,
                )

            payment_id = f"FORZADO-{str(offer.token)[:8]}"
            offer = _finalize_paid_offer(offer, payment_id=payment_id, forced=True)

        return Response({"status": "forced", **_serialize_offer(offer)}, status=status.HTTP_201_CREATED)


class PromotionReacomodamientoDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token_slug):
        offer = get_object_or_404(
            PromotionOffer.objects.select_related("reasignacion_log"),
            token=token_slug,
            process_type=PromotionOffer.ProcessType.REACOMODAMIENTO,
        )
        if not offer.reasignacion_log:
            return Response(
                {"status": "token_invalido", "error": "Oferta de reacomodamiento inválida."},
                status=status.HTTP_404_NOT_FOUND,
            )

        from apps.turnos.services.reasignacion_service import obtener_detalles_oferta_reasignacion

        resultado = obtener_detalles_oferta_reasignacion(str(offer.reasignacion_log.token))
        if resultado.get("status") == "activa":
            return Response(resultado, status=status.HTTP_200_OK)
        if resultado.get("status") == "ya_resuelta":
            if resultado.get("estado") == "aceptada":
                offer.status = PromotionOffer.Status.ACCEPTED
            elif resultado.get("estado") == "rechazada":
                offer.status = PromotionOffer.Status.REJECTED
            else:
                offer.status = PromotionOffer.Status.EXPIRED
            offer.save(update_fields=["status", "updated_at"])
            return Response(resultado, status=status.HTTP_410_GONE)
        if resultado.get("status") == "expirada":
            offer.status = PromotionOffer.Status.EXPIRED
            offer.save(update_fields=["status", "updated_at"])
            return Response(resultado, status=status.HTTP_410_GONE)
        if resultado.get("status") == "token_invalido":
            return Response(resultado, status=status.HTTP_404_NOT_FOUND)
        return Response(resultado, status=status.HTTP_400_BAD_REQUEST)


class PromotionReacomodamientoResponderView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, token_slug):
        accion = request.data.get("accion") or request.query_params.get("accion")
        if accion not in ["aceptar", "rechazar"]:
            return Response(
                {"error": "Acción inválida. Use 'aceptar' o 'rechazar'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        offer = get_object_or_404(
            PromotionOffer.objects.select_related("reasignacion_log", "turno"),
            token=token_slug,
            process_type=PromotionOffer.ProcessType.REACOMODAMIENTO,
        )
        if not offer.reasignacion_log:
            return Response(
                {"status": "token_invalido", "error": "Oferta de reacomodamiento inválida."},
                status=status.HTTP_404_NOT_FOUND,
            )

        from apps.turnos.services.reasignacion_service import responder_oferta_reasignacion

        resultado = responder_oferta_reasignacion(str(offer.reasignacion_log.token), accion)
        estado = resultado.get("status")

        if estado == "aceptada":
            offer.status = PromotionOffer.Status.ACCEPTED
            offer.accepted_at = timezone.now()
            offer.turno_id = resultado.get("turno_id") or offer.turno_id
            offer.save(update_fields=["status", "accepted_at", "turno", "updated_at"])
            PromotionOffer.objects.filter(
                campaign_id=offer.campaign_id,
                process_type=PromotionOffer.ProcessType.REACOMODAMIENTO,
                status=PromotionOffer.Status.SENT,
            ).exclude(pk=offer.pk).update(status=PromotionOffer.Status.TAKEN_BY_OTHER)
            return Response(resultado, status=status.HTTP_200_OK)

        if estado == "rechazada":
            offer.status = PromotionOffer.Status.REJECTED
            offer.save(update_fields=["status", "updated_at"])
            return Response(resultado, status=status.HTTP_200_OK)

        if estado == "expirada":
            offer.status = PromotionOffer.Status.EXPIRED
            offer.save(update_fields=["status", "updated_at"])
            return Response(resultado, status=status.HTTP_200_OK)

        if estado == "ya_resuelta":
            final = resultado.get("estado")
            if final == "aceptada":
                offer.status = PromotionOffer.Status.ACCEPTED
            elif final == "rechazada":
                offer.status = PromotionOffer.Status.REJECTED
            elif final == "expirada":
                offer.status = PromotionOffer.Status.EXPIRED
            offer.save(update_fields=["status", "updated_at"])
            return Response(resultado, status=status.HTTP_200_OK)

        if estado in ["hueco_no_disponible", "turno_ofrecido_no_disponible"]:
            offer.status = PromotionOffer.Status.TAKEN_BY_OTHER
            offer.save(update_fields=["status", "updated_at"])
            return Response(resultado, status=status.HTTP_409_CONFLICT)

        if estado in ["token_invalido", "accion_invalida"]:
            return Response(resultado, status=status.HTTP_400_BAD_REQUEST)

        return Response(resultado, status=status.HTTP_400_BAD_REQUEST)


def validar_acceso_magico(request, token_slug):
    """Vista de autologin mediante un AccessToken de un solo uso.

    Flujo:
    - Busca el token por UUID y verifica que no haya sido usado.
    - Si expiró, lo marca como usado y redirige al frontend con error.
    - Si es válido, autentica al usuario, genera un token DRF y decide si
      el beneficio es "saldo" o "descuento" según la billetera.
    - Redirige al frontend a la página de fidelización con el token y el
      tipo de beneficio en la querystring.
    """

    access_token = get_object_or_404(
        AccessToken,
        token=token_slug,
        used_at__isnull=True,
    )

    # Si el token está expirado, lo invalidamos y redirigimos con error
    if access_token.is_expired:
        access_token.mark_used()
        expired_url = (
            f"{settings.FRONTEND_URL}/fidelizacion/confirmar?error=token_expired"
        )
        return redirect(expired_url)

    user = access_token.user

    # Autenticación de sesión tradicional (por si se usa en vistas Django)
    django_login(request, user, backend="django.contrib.auth.backends.ModelBackend")

    # Token DRF para el frontend (Next.js) – autologin por API
    api_token, _ = DRFToken.objects.get_or_create(user=user)

    # Marcar el AccessToken como usado (one-shot)
    access_token.mark_used()

    # Determinar si el cliente tiene saldo en billetera
    tiene_saldo = False
    try:
        billetera = Billetera.objects.get(cliente__user=user)
        tiene_saldo = billetera.saldo > 0
    except Billetera.DoesNotExist:
        billetera = None

    beneficio = "saldo" if tiene_saldo else "descuento"

    # Construir URL de destino en el frontend
    base_url = f"{settings.FRONTEND_URL}/fidelizacion/confirmar"
    redirect_url = f"{base_url}?auth_token={api_token.key}&beneficio={beneficio}"

    return redirect(redirect_url)
