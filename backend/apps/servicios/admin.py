from django.contrib import admin
from .models import CategoriaServicio, Servicio

@admin.register(CategoriaServicio)
class CategoriaServicioAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('nombre', 'descripcion')
    ordering = ('nombre',)

@admin.register(Servicio)
class ServicioAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'categoria', 'precio', 'duracion_minutos', 'is_active', 'created_at')
    list_filter = ('categoria', 'is_active', 'created_at')
    search_fields = ('nombre', 'descripcion')
    ordering = ('categoria__nombre', 'nombre')
    list_select_related = ('categoria',)
