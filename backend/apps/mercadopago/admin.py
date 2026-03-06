"""Admin para la app de Mercado Pago"""

from django.contrib import admin
from django.utils.html import format_html
from .models import PagoMercadoPago


@admin.register(PagoMercadoPago)
class PagoMercadoPagoAdmin(admin.ModelAdmin):
    """Administración de pagos de Mercado Pago"""

    list_display = [
        "id",
        "turno",
        "cliente",
        "monto",
        "estado_badge",
        "preference_id_corto",
        "payment_id",
        "creado_en",
        "actualizado_en",
    ]
    list_filter = ["estado", "creado_en"]
    search_fields = [
        "preference_id",
        "payment_id",
        "turno__id",
        "cliente__user__email",
        "cliente__user__first_name",
        "cliente__user__last_name",
    ]
    readonly_fields = [
        "preference_id",
        "payment_id",
        "init_point",
        "creado_en",
        "actualizado_en",
    ]
    ordering = ["-creado_en"]

    fieldsets = (
        (
            "Información del Pago",
            {
                "fields": (
                    "turno",
                    "cliente",
                    "monto",
                    "descripcion",
                    "estado",
                )
            },
        ),
        (
            "Datos de Mercado Pago",
            {
                "fields": (
                    "preference_id",
                    "payment_id",
                    "init_point",
                )
            },
        ),
        (
            "Fechas",
            {
                "fields": ("creado_en", "actualizado_en"),
                "classes": ("collapse",),
            },
        ),
    )

    def estado_badge(self, obj):
        colors = {
            "approved": "#28a745",
            "pending": "#fd7e14",
            "rejected": "#dc3545",
            "cancelled": "#6c757d",
            "refunded": "#17a2b8",
            "in_process": "#007bff",
        }
        color = colors.get(obj.estado, "#6c757d")
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;border-radius:4px;">{}</span>',
            color,
            obj.get_estado_display(),
        )

    estado_badge.short_description = "Estado"

    def preference_id_corto(self, obj):
        if obj.preference_id and len(obj.preference_id) > 20:
            return obj.preference_id[:20] + "…"
        return obj.preference_id

    preference_id_corto.short_description = "Preference ID"
