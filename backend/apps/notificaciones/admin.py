from django.contrib import admin
from .models import NotificacionConfig, Notificacion


@admin.register(NotificacionConfig)
class NotificacionConfigAdmin(admin.ModelAdmin):
    list_display = ['user', 'notificar_solicitud_turno', 'notificar_pago_turno', 'updated_at']
    list_filter = ['notificar_solicitud_turno', 'notificar_pago_turno', 'created_at']
    search_fields = ['user__email', 'user__first_name', 'user__last_name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Notificacion)
class NotificacionAdmin(admin.ModelAdmin):
    list_display = ['usuario', 'tipo', 'titulo', 'leida', 'created_at']
    list_filter = ['tipo', 'leida', 'created_at']
    search_fields = ['usuario__email', 'titulo', 'mensaje']
    readonly_fields = ['created_at', 'leida_at']
    
    def has_add_permission(self, request):
        # Las notificaciones se crean automáticamente
        return False
