"""URLs para la app de turnos"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"", views.TurnoViewSet, basename="turno")

urlpatterns = [
    path("", include(router.urls)),
    path("<int:turno_id>/historial/", views.historial_turno, name="historial-turno"),
]
