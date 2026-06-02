"""URLs para la app de clientes"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ClienteViewSet,
    cliente_me_view,
    mi_billetera_view,
    movimientos_billetera_view,
    streak_status_view,
    claim_streak_coupon_view,
    validate_streak_coupon_view,
    active_reasignacion_offer_view,
    active_fidelizacion_offer_view,
)

router = DefaultRouter()
router.register(r"", ClienteViewSet, basename="cliente")

urlpatterns = [
    # Endpoint para perfil del cliente autenticado
    path("me/", cliente_me_view, name="cliente-me"),
    # Endpoints para billetera
    path("me/billetera/", mi_billetera_view, name="mi-billetera"),
    path(
        "me/billetera/movimientos/",
        movimientos_billetera_view,
        name="movimientos-billetera",
    ),
    path("me/streak/", streak_status_view, name="cliente-streak"),
    path(
        "me/streak-coupons/<int:coupon_id>/claim/",
        claim_streak_coupon_view,
        name="claim-streak-coupon",
    ),
    path(
        "me/streak-coupons/validate/",
        validate_streak_coupon_view,
        name="validate-streak-coupon",
    ),
    path(
        "me/reacomodamiento-activo/",
        active_reasignacion_offer_view,
        name="active-reasignacion-offer",
    ),
    path(
        "me/fidelizacion-activa/",
        active_fidelizacion_offer_view,
        name="active-fidelizacion-offer",
    ),
    # Endpoints del ViewSet
    path("", include(router.urls)),
]
