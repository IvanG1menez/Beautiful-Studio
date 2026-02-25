from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Cliente, Billetera, MovimientoBilletera


class MovimientoBilleteraInline(admin.TabularInline):
    """Inline para mostrar movimientos de billetera"""

    model = MovimientoBilletera
    extra = 0
    readonly_fields = (
        "tipo",
        "monto",
        "saldo_anterior",
        "saldo_nuevo",
        "descripcion",
        "turno",
        "created_at",
    )
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Billetera)
class BilleteraAdmin(admin.ModelAdmin):
    """Administración de billeteras"""

    list_display = (
        "id",
        "cliente_nombre",
        "saldo",
        "updated_at",
    )
    list_filter = ("created_at", "updated_at")
    search_fields = (
        "cliente__user__first_name",
        "cliente__user__last_name",
        "cliente__user__email",
    )
    readonly_fields = ("created_at", "updated_at")
    inlines = [MovimientoBilleteraInline]

    def cliente_nombre(self, obj):
        return obj.cliente.nombre_completo

    cliente_nombre.short_description = "Cliente"


@admin.register(MovimientoBilletera)
class MovimientoBilleteraAdmin(admin.ModelAdmin):
    """Administración de movimientos de billetera"""

    list_display = (
        "id",
        "billetera_cliente",
        "tipo",
        "monto",
        "saldo_nuevo",
        "created_at",
    )
    list_filter = ("tipo", "created_at")
    search_fields = (
        "billetera__cliente__user__first_name",
        "billetera__cliente__user__last_name",
        "descripcion",
    )
    readonly_fields = (
        "billetera",
        "tipo",
        "monto",
        "saldo_anterior",
        "saldo_nuevo",
        "descripcion",
        "turno",
        "created_at",
    )

    def billetera_cliente(self, obj):
        return obj.billetera.cliente.nombre_completo

    billetera_cliente.short_description = "Cliente"

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Cliente)
class ClienteAdmin(SimpleHistoryAdmin):
    list_display = (
        "id",
        "nombre_completo",
        "email",
        "telefono",
        "is_vip",
        "saldo_billetera",
        "created_at",
    )
    list_filter = ("is_vip", "created_at")
    search_fields = (
        "user__first_name",
        "user__last_name",
        "user__email",
        "user__username",
    )
    ordering = ("-created_at",)

    def saldo_billetera(self, obj):
        """Muestra el saldo de la billetera si existe"""
        try:
            return f"${obj.billetera.saldo}"
        except:
            return "$0.00"

    saldo_billetera.short_description = "Saldo"
