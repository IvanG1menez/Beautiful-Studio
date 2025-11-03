from django.contrib import admin
from .models import Empleado, EmpleadoServicio, HorarioEmpleado


@admin.register(Empleado)
class EmpleadoAdmin(admin.ModelAdmin):
    list_display = ["user", "especialidades", "is_disponible", "fecha_ingreso"]
    list_filter = ["especialidades", "is_disponible"]
    search_fields = ["user__first_name", "user__last_name", "user__email"]


@admin.register(EmpleadoServicio)
class EmpleadoServicioAdmin(admin.ModelAdmin):
    list_display = ["empleado", "servicio", "nivel_experiencia"]
    list_filter = ["nivel_experiencia"]
    search_fields = [
        "empleado__user__first_name",
        "empleado__user__last_name",
        "servicio__nombre",
    ]


@admin.register(HorarioEmpleado)
class HorarioEmpleadoAdmin(admin.ModelAdmin):
    list_display = [
        "empleado",
        "dia_semana_display",
        "hora_inicio",
        "hora_fin",
        "is_active",
    ]
    list_filter = ["dia_semana", "is_active"]
    search_fields = ["empleado__user__first_name", "empleado__user__last_name"]

    def dia_semana_display(self, obj):
        return obj.get_dia_semana_display()

    dia_semana_display.short_description = "Día"
