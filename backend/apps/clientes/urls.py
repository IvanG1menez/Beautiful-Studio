"""URLs para la app de clientes"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClienteViewSet, cliente_me_view

router = DefaultRouter()
router.register(r"", ClienteViewSet, basename="cliente")

urlpatterns = [
    # Endpoint para perfil del cliente autenticado
    path("me/", cliente_me_view, name="cliente-me"),
    # Endpoints del ViewSet
    path("", include(router.urls)),
]
