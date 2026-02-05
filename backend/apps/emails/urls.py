from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NotificacionViewSet, NotificacionConfigViewSet

router = DefaultRouter()
router.register(r'notificaciones', NotificacionViewSet, basename='notificacion')
router.register(r'notificaciones-config', NotificacionConfigViewSet, basename='notificacion-config')

urlpatterns = [
    path('', include(router.urls)),
]
