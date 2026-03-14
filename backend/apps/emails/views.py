from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404, redirect
from django.conf import settings
from django.contrib.auth import login as django_login
from rest_framework.authtoken.models import Token as DRFToken

from apps.clientes.models import Billetera
from .models import Notificacion, NotificacionConfig, AccessToken
from .serializers import NotificacionSerializer, NotificacionConfigSerializer


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
