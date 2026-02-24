from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin
from .models import CategoriaServicio, Servicio, Sala


@admin.register(CategoriaServicio)
class CategoriaServicioAdmin(admin.ModelAdmin):
    list_display = ("nombre", "sala", "is_active", "created_at")
    list_filter = ("is_active", "created_at", "sala")
    search_fields = ("nombre", "descripcion")
    ordering = ("nombre",)


@admin.register(Servicio)
class ServicioAdmin(SimpleHistoryAdmin):
    list_display = (
        "nombre",
        "categoria",
        "precio",
        "descuento_reasignacion",
        "duracion_minutos",
        "is_active",
        "created_at",
    )
    list_filter = ("categoria", "is_active", "created_at")
    search_fields = ("nombre", "descripcion")
    ordering = ("categoria__nombre", "nombre")
    list_select_related = ("categoria",)


@admin.register(Sala)
class SalaAdmin(SimpleHistoryAdmin):
    list_display = ("nombre", "capacidad_simultanea")
    search_fields = ("nombre",)
    ordering = ("nombre",)
