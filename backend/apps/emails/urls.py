from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    NotificacionViewSet,
    NotificacionConfigViewSet,
    validar_acceso_magico,
)

router = DefaultRouter()
router.register(r"notificaciones", NotificacionViewSet, basename="notificacion")
router.register(
    r"notificaciones-config",
    NotificacionConfigViewSet,
    basename="notificacion-config",
)

urlpatterns = [
    # Magic link / access token autologin
    path(
        "acceso-magico/<uuid:token_slug>/",
        validar_acceso_magico,
        name="validar-acceso-magico",
    ),
    path("", include(router.urls)),
]
