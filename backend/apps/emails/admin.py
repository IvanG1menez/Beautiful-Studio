from django.contrib import admin
from .models import NotificacionConfig, Notificacion, PasswordResetToken


@admin.register(NotificacionConfig)
class NotificacionConfigAdmin(admin.ModelAdmin):
    list_display = [
        "user",
        "notificar_solicitud_turno",
        "notificar_pago_turno",
        "updated_at",
    ]
    list_filter = ["notificar_solicitud_turno", "notificar_pago_turno", "created_at"]
    search_fields = ["user__email", "user__first_name", "user__last_name"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(Notificacion)
class NotificacionAdmin(admin.ModelAdmin):
    list_display = ["usuario", "tipo", "titulo", "leida", "created_at"]
    list_filter = ["tipo", "leida", "created_at"]
    search_fields = ["usuario__email", "titulo", "mensaje"]
    readonly_fields = ["created_at", "leida_at"]

    def has_add_permission(self, request):
        # Las notificaciones se crean automáticamente
        return False


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = [
        "user",
        "token_preview",
        "created_at",
        "expires_at",
        "used",
        "is_valid_status",
    ]
    list_filter = ["used", "created_at", "expires_at"]
    search_fields = ["user__email", "token"]
    readonly_fields = ["created_at", "used_at"]

    def token_preview(self, obj):
        """Muestra solo los primeros caracteres del token por seguridad"""
        return f"{obj.token[:20]}..."

    token_preview.short_description = "Token"

    def is_valid_status(self, obj):
        """Muestra si el token es válido"""
        return "✅ Válido" if obj.is_valid() else "❌ Inválido"

    is_valid_status.short_description = "Estado"

    def has_add_permission(self, request):
        # Los tokens se crean mediante la API
        return False
