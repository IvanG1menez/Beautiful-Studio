from django.contrib import admin
from .models import (
    PermisoAdicional,
    Configuracion,
    AuditoriaAcciones
)


@admin.register(PermisoAdicional)
class PermisoAdicionalAdmin(admin.ModelAdmin):
    """
    Configuración del admin para PermisoAdicional
    """
    list_display = [
        'nombre', 'descripcion', 'activo', 'total_usuarios', 'created_at'
    ]
    list_filter = ['activo', 'nombre', 'created_at']
    search_fields = ['nombre', 'descripcion']
    filter_horizontal = ['usuarios']
    readonly_fields = ['created_at', 'updated_at']
    
    def total_usuarios(self, obj):
        return obj.usuarios.count()
    total_usuarios.short_description = 'Total Usuarios'


@admin.register(Configuracion)
class ConfiguracionAdmin(admin.ModelAdmin):
    """
    Configuración del admin para Configuracion
    """
    list_display = [
        'clave', 'valor', 'tipo_dato', 'activo', 'created_at'
    ]
    list_filter = ['tipo_dato', 'activo', 'created_at']
    search_fields = ['clave', 'descripcion', 'valor']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['clave']


@admin.register(AuditoriaAcciones)
class AuditoriaAccionesAdmin(admin.ModelAdmin):
    """
    Configuración del admin para AuditoriaAcciones
    """
    list_display = [
        'usuario', 'accion', 'modelo_afectado', 'objeto_id',
        'ip_address', 'created_at'
    ]
    list_filter = ['accion', 'modelo_afectado', 'created_at']
    search_fields = [
        'usuario__username', 'usuario__email', 'modelo_afectado',
        'ip_address'
    ]
    readonly_fields = [
        'usuario', 'accion', 'modelo_afectado', 'objeto_id',
        'detalles', 'ip_address', 'user_agent', 'created_at'
    ]
    ordering = ['-created_at']
    
    def has_add_permission(self, request):
        """
        No permitir agregar registros de auditoría manualmente
        """
        return False
    
    def has_change_permission(self, request, obj=None):
        """
        No permitir modificar registros de auditoría
        """
        return False
    
    def has_delete_permission(self, request, obj=None):
        """
        No permitir eliminar registros de auditoría
        """
        return False
