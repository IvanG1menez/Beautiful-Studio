from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Cliente


@admin.register(Cliente)
class ClienteAdmin(SimpleHistoryAdmin):
    list_display = (
        "id",
        "nombre_completo",
        "email",
        "telefono",
        "is_vip",
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
