"""URLs para la app de turnos"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import views_historial

router = DefaultRouter()
router.register(r"", views.TurnoViewSet, basename="turno")

urlpatterns = [
    path("", include(router.urls)),
    path("<int:turno_id>/historial/", views.historial_turno, name="historial-turno"),
    path(
        "reasignacion/<uuid:token>/",
        views.responder_reasignacion,
        name="responder-reasignacion",
    ),
    # Historial general
    path(
        "historial/listar/", views_historial.listar_historial, name="listar-historial"
    ),
    path(
        "historial/<str:modelo>/<int:history_id>/",
        views_historial.detalle_historial,
        name="detalle-historial",
    ),
    path(
        "historial/<str:modelo>/<int:history_id>/restaurar/",
        views_historial.restaurar_desde_historial,
        name="restaurar-historial",
    ),
]
