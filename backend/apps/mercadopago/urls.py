from django.urls import path

from .views import (
    CancelarPagoStaffView,
    ComprobantePagoPDFView,
    ComprobantePagoView,
    ConfirmarCobroManualView,
    ConfirmarPagoStaffView,
    CrearPreferenciaView,
    CrearPreferenciaSinTurnoView,
    CrearPreferenciaReprogramacionView,
    CrearPreferenciaStaffView,
    ListarPagosView,
    VerificarPagoView,
    WebhookMercadoPagoView,
)

app_name = "mercadopago"

urlpatterns = [
    path("preferencia/", CrearPreferenciaView.as_view(), name="crear-preferencia"),
    path(
        "preferencia-sin-turno/",
        CrearPreferenciaSinTurnoView.as_view(),
        name="crear-preferencia-sin-turno",
    ),
    path(
        "preferencia-staff/",
        CrearPreferenciaStaffView.as_view(),
        name="crear-preferencia-staff",
    ),
    path(
        "confirmar-pago-staff/",
        ConfirmarPagoStaffView.as_view(),
        name="confirmar-pago-staff",
    ),
    path(
        "cancelar-pago-staff/",
        CancelarPagoStaffView.as_view(),
        name="cancelar-pago-staff",
    ),
    path(
        "confirmar-cobro-manual/",
        ConfirmarCobroManualView.as_view(),
        name="confirmar-cobro-manual",
    ),
    path(
        "preferencia-reprogramacion/",
        CrearPreferenciaReprogramacionView.as_view(),
        name="crear-preferencia-reprogramacion",
    ),
    path("webhook/", WebhookMercadoPagoView.as_view(), name="webhook-mercadopago"),
    path("pagos/", ListarPagosView.as_view(), name="listar-pagos"),
    path(
        "verificar-pago/<str:preference_id>/",
        VerificarPagoView.as_view(),
        name="verificar-pago",
    ),
    path(
        "comprobante/<int:turno_id>/",
        ComprobantePagoView.as_view(),
        name="comprobante-pago",
    ),
    path(
        "comprobante/<int:turno_id>/pdf/",
        ComprobantePagoPDFView.as_view(),
        name="comprobante-pago-pdf",
    ),
]
