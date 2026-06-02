"""URLs para la app de turnos"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import views_historial
from . import views_reportes
from . import views_oportunidades
from . import views_diagnostico

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
    # Reportes
    path(
        "reportes/finanzas/", views_reportes.reportes_finanzas, name="reportes-finanzas"
    ),
    path(
        "reportes/billetera/",
        views_reportes.reportes_billetera,
        name="reportes-billetera",
    ),
    path(
        "reportes/automatizaciones/",
        views_reportes.reportes_automatizaciones,
        name="reportes-automatizaciones",
    ),
    path(
        "reportes/clientes/",
        views_reportes.reportes_clientes,
        name="reportes-clientes",
    ),
    path(
        "reportes/salas/",
        views_reportes.reportes_salas,
        name="reportes-salas",
    ),
    path(
        "reportes/profesionales/",
        views_reportes.reportes_profesionales,
        name="reportes-profesionales",
    ),
    # Oportunidades de Agenda
    path(
        "oportunidades/",
        views_oportunidades.oportunidades_agenda_view,
        name="oportunidades-agenda",
    ),
    path(
        "oportunidades/<int:cliente_id>/invitar/",
        views_oportunidades.enviar_invitacion_reincorporacion,
        name="invitar-reincorporacion",
    ),
    # Herramientas de Diagnóstico
    path(
        "diagnostico/preparar-datos/",
        views_diagnostico.diagnostico_preparar_datos,
        name="diagnostico-preparar-datos",
    ),
    path(
        "diagnostico/limpiar-datos/",
        views_diagnostico.diagnostico_limpiar_datos,
        name="diagnostico-limpiar-datos",
    ),
    path(
        "diagnostico/optimizacion-agenda/",
        views_diagnostico.diagnostico_optimizacion_agenda,
        name="diagnostico-optimizacion",
    ),
    path(
        "diagnostico/fidelizacion-clientes/",
        views_diagnostico.diagnostico_fidelizacion_clientes,
        name="diagnostico-fidelizacion",
    ),
    path(
        "diagnostico/simular-no-respuesta/",
        views_diagnostico.diagnostico_simular_no_respuesta,
        name="diagnostico-simular-no-respuesta",
    ),
    path(
        "diagnostico/fidelidad-racha/",
        views_diagnostico.diagnostico_fidelidad_racha,
        name="diagnostico-fidelidad-racha",
    ),
]
