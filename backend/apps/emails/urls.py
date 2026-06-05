from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    NotificacionViewSet,
    NotificacionConfigViewSet,
    PromotionOfferAcceptView,
    PromotionOfferDetailView,
    PromotionOfferForcePaymentView,
    PromotionOfferPaymentView,
    PromotionReacomodamientoDetailView,
    PromotionReacomodamientoResponderView,
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
    path(
        "promociones/<uuid:token_slug>/",
        PromotionOfferDetailView.as_view(),
        name="promotion-offer-detail",
    ),
    path(
        "promociones/<uuid:token_slug>/aceptar/",
        PromotionOfferAcceptView.as_view(),
        name="promotion-offer-accept",
    ),
    path(
        "promociones/<uuid:token_slug>/pago/",
        PromotionOfferPaymentView.as_view(),
        name="promotion-offer-payment",
    ),
    path(
        "promociones/<uuid:token_slug>/forzar-pago/",
        PromotionOfferForcePaymentView.as_view(),
        name="promotion-offer-force-payment",
    ),
    path(
        "promociones/<uuid:token_slug>/reacomodamiento/",
        PromotionReacomodamientoDetailView.as_view(),
        name="promotion-reacomodamiento-detail",
    ),
    path(
        "promociones/<uuid:token_slug>/reacomodamiento/responder/",
        PromotionReacomodamientoResponderView.as_view(),
        name="promotion-reacomodamiento-responder",
    ),
    path("", include(router.urls)),
]
