from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import Notificacion, NotificacionConfig
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

    @action(detail=True, methods=['post'])
    def marcar_leida(self, request, pk=None):
        """Marca una notificación como leída"""
        notificacion = self.get_object()
        notificacion.marcar_leida()
        serializer = self.get_serializer(notificacion)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def marcar_todas_leidas(self, request):
        """Marca todas las notificaciones no leídas como leídas"""
        notificaciones = self.get_queryset().filter(leida=False)
        count = notificaciones.count()
        
        for notificacion in notificaciones:
            notificacion.marcar_leida()
        
        return Response({
            'message': f'{count} notificaciones marcadas como leídas',
            'count': count
        })

    @action(detail=False, methods=['get'])
    def no_leidas(self, request):
        """Obtiene solo las notificaciones no leídas"""
        notificaciones = self.get_queryset().filter(leida=False)
        serializer = self.get_serializer(notificaciones, many=True)
        return Response({
            'count': notificaciones.count(),
            'results': serializer.data
        })

    @action(detail=False, methods=['get'])
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
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        """Actualización parcial de la configuración"""
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)
