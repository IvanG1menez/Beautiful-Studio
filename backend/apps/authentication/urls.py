from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Configuración del router para los ViewSets
router = DefaultRouter()
router.register(r"permisos", views.PermisoAdicionalViewSet)
router.register(r"configuracion", views.ConfiguracionViewSet)
router.register(r"auditoria", views.AuditoriaAccionesViewSet)
router.register(r"usuarios-basico", views.UsuarioBasicoViewSet)

app_name = "core"

urlpatterns = [
    # Rutas de autenticación
    path("register/", views.register, name="register"),
    path("login/", views.login, name="login"),
    path("logout/", views.logout, name="logout"),
    # Recuperación de contraseña
    path(
        "password-reset/request/",
        views.request_password_reset,
        name="password-reset-request",
    ),
    path(
        "password-reset/confirm/", views.reset_password, name="password-reset-confirm"
    ),
    # Configuración SSO
    path("configuracion/sso/", views.configuracion_sso_view, name="configuracion-sso"),
    path(
        "configuracion/sso/public/",
        views.configuracion_sso_public_view,
        name="configuracion-sso-public",
    ),
    # Health check
    path("health/", views.health_check, name="health_check"),
    # Incluir todas las rutas de los ViewSets
    path("", include(router.urls)),
]
