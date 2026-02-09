from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin
from django.utils.html import format_html
from django.urls import reverse
from django.utils import timezone
from .models import Turno, HistorialTurno, LogReasignacion


class HistorialTurnoInline(admin.TabularInline):
    """Inline para mostrar historial de cambios dentro del turno"""

    model = HistorialTurno
    extra = 0
    readonly_fields = [
        "usuario",
        "accion",
        "estado_anterior",
        "estado_nuevo",
        "observaciones",
        "created_at",
    ]
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Turno)
class TurnoAdmin(SimpleHistoryAdmin):
    """Administración de Turnos en Django Admin"""

    list_display = [
        "id",
        "fecha_hora_formateada",
        "cliente_link",
        "empleado_link",
        "servicio_nombre",
        "estado_badge",
        "precio_final",
        "senia_pagada",
        "puede_cancelar_display",
        "created_at_formateado",
    ]

    list_filter = [
        "estado",
        "fecha_hora",
        "created_at",
        "empleado",
        "servicio__categoria",
    ]

    search_fields = [
        "cliente__user__first_name",
        "cliente__user__last_name",
        "cliente__user__email",
        "empleado__user__first_name",
        "empleado__user__last_name",
        "servicio__nombre",
    ]

    readonly_fields = [
        "created_at",
        "updated_at",
        "fecha_hora_fin",
        "duracion",
        "puede_cancelar_display",
    ]

    fieldsets = (
        (
            "Información del Turno",
            {
                "fields": (
                    ("cliente", "empleado"),
                    ("servicio", "fecha_hora"),
                    "estado",
                )
            },
        ),
        (
            "Detalles del Servicio",
            {
                "fields": (
                    "precio_final",
                    "senia_pagada",
                    "duracion",
                    "fecha_hora_fin",
                )
            },
        ),
        (
            "Notas y Observaciones",
            {
                "fields": (
                    "notas_cliente",
                    "notas_empleado",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Información del Sistema",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                    "puede_cancelar_display",
                ),
                "classes": ("collapse",),
            },
        ),
    )

    inlines = [HistorialTurnoInline]

    date_hierarchy = "fecha_hora"

    ordering = ["-fecha_hora"]

    list_per_page = 25

    actions = ["confirmar_turnos", "cancelar_turnos", "marcar_completados"]

    def fecha_hora_formateada(self, obj):
        """Formato amigable de fecha y hora"""
        return obj.fecha_hora.strftime("%d/%m/%Y %H:%M")

    fecha_hora_formateada.short_description = "Fecha y Hora"
    fecha_hora_formateada.admin_order_field = "fecha_hora"

    def cliente_link(self, obj):
        """Link al cliente"""
        if obj.cliente:
            # Usar el nombre correcto del modelo registrado en admin
            try:
                url = reverse("admin:clientes_cliente_change", args=[obj.cliente.pk])
                return format_html(
                    '<a href="{}">{}</a>', url, obj.cliente.nombre_completo
                )
            except:
                # Si no está registrado en admin, mostrar solo el nombre
                return obj.cliente.nombre_completo
        return "-"

    cliente_link.short_description = "Cliente"

    def empleado_link(self, obj):
        """Link al empleado/profesional"""
        if obj.empleado:
            # Usar el nombre correcto del modelo registrado en admin
            try:
                url = reverse("admin:empleados_empleado_change", args=[obj.empleado.pk])
                return format_html(
                    '<a href="{}">{}</a>', url, obj.empleado.nombre_completo
                )
            except:
                # Si no está registrado en admin, mostrar solo el nombre
                return obj.empleado.nombre_completo
        return "-"

    empleado_link.short_description = "Profesional"

    def servicio_nombre(self, obj):
        """Nombre del servicio con categoría"""
        if obj.servicio:
            return f"{obj.servicio.categoria.nombre} - {obj.servicio.nombre}"
        return "-"

    servicio_nombre.short_description = "Servicio"

    def estado_badge(self, obj):
        """Badge con color según el estado"""
        colores = {
            "pendiente": "#FFA500",  # Naranja
            "confirmado": "#2196F3",  # Azul
            "en_proceso": "#9C27B0",  # Púrpura
            "completado": "#4CAF50",  # Verde
            "cancelado": "#F44336",  # Rojo
            "no_asistio": "#757575",  # Gris
            "oferta_enviada": "#FF9800",  # Naranja intenso
            "expirada": "#9E9E9E",  # Gris claro
        }
        color = colores.get(obj.estado, "#000000")
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px; font-weight: bold;">{}</span>',
            color,
            obj.get_estado_display(),
        )

    estado_badge.short_description = "Estado"
    estado_badge.admin_order_field = "estado"

    def puede_cancelar_display(self, obj):
        """Indicador visual de si se puede cancelar"""
        puede = obj.puede_cancelar()
        if puede:
            return format_html(
                '<span style="color: green; font-weight: bold;">✓ Sí</span>'
            )
        return format_html('<span style="color: red; font-weight: bold;">✗ No</span>')

    puede_cancelar_display.short_description = "¿Puede cancelar?"

    def created_at_formateado(self, obj):
        """Formato amigable de fecha de creación"""
        return obj.created_at.strftime("%d/%m/%Y %H:%M")

    created_at_formateado.short_description = "Creado"
    created_at_formateado.admin_order_field = "created_at"

    # Acciones masivas
    def confirmar_turnos(self, request, queryset):
        """Confirmar turnos seleccionados"""
        turnos_pendientes = queryset.filter(estado="pendiente")
        count = turnos_pendientes.update(estado="confirmado")

        # Registrar en historial
        for turno in turnos_pendientes:
            HistorialTurno.objects.create(
                turno=turno,
                usuario=request.user,
                accion="Confirmación masiva",
                estado_anterior="pendiente",
                estado_nuevo="confirmado",
                observaciones=f"Confirmado por {request.user.full_name} desde admin",
            )

        self.message_user(request, f"{count} turno(s) confirmado(s) exitosamente.")

    confirmar_turnos.short_description = "Confirmar turnos seleccionados"

    def cancelar_turnos(self, request, queryset):
        """Cancelar turnos seleccionados"""
        turnos_cancelables = queryset.exclude(
            estado__in=["completado", "cancelado", "no_asistio"]
        )
        count = 0

        for turno in turnos_cancelables:
            if turno.puede_cancelar():
                estado_anterior = turno.estado
                turno.estado = "cancelado"
                turno.save()

                HistorialTurno.objects.create(
                    turno=turno,
                    usuario=request.user,
                    accion="Cancelación masiva",
                    estado_anterior=estado_anterior,
                    estado_nuevo="cancelado",
                    observaciones=f"Cancelado por {request.user.full_name} desde admin",
                )
                count += 1

        self.message_user(request, f"{count} turno(s) cancelado(s) exitosamente.")

    cancelar_turnos.short_description = "Cancelar turnos seleccionados"

    def marcar_completados(self, request, queryset):
        """Marcar turnos como completados"""
        turnos_en_proceso = queryset.filter(estado="en_proceso")
        count = 0

        for turno in turnos_en_proceso:
            turno.estado = "completado"
            turno.save()

            HistorialTurno.objects.create(
                turno=turno,
                usuario=request.user,
                accion="Completado masivamente",
                estado_anterior="en_proceso",
                estado_nuevo="completado",
                observaciones=f"Completado por {request.user.full_name} desde admin",
            )
            count += 1

        self.message_user(request, f"{count} turno(s) marcado(s) como completado(s).")

    marcar_completados.short_description = "Marcar como completados"

    def get_queryset(self, request):
        """Optimizar consultas con select_related"""
        qs = super().get_queryset(request)
        return qs.select_related(
            "cliente__user", "empleado__user", "servicio__categoria"
        )

    def save_model(self, request, obj, form, change):
        """Registrar cambios en historial al guardar"""
        if change:
            # Obtener el objeto original
            original = Turno.objects.get(pk=obj.pk)

            # Si cambió el estado, registrar
            if original.estado != obj.estado:
                super().save_model(request, obj, form, change)
                HistorialTurno.objects.create(
                    turno=obj,
                    usuario=request.user,
                    accion="Cambio de estado desde admin",
                    estado_anterior=original.estado,
                    estado_nuevo=obj.estado,
                    observaciones=f"Modificado por {request.user.full_name}",
                )
                return
        else:
            # Nuevo turno
            super().save_model(request, obj, form, change)
            HistorialTurno.objects.create(
                turno=obj,
                usuario=request.user,
                accion="Turno creado desde admin",
                estado_nuevo=obj.estado,
                observaciones=f"Creado por {request.user.full_name}",
            )
            return

        super().save_model(request, obj, form, change)


@admin.register(LogReasignacion)
class LogReasignacionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "turno_cancelado",
        "turno_ofrecido",
        "cliente_notificado",
        "monto_descuento",
        "fecha_envio",
        "estado_final",
        "expires_at",
    )
    list_filter = ("estado_final", "fecha_envio")
    search_fields = (
        "cliente_notificado__nombre_completo",
        "turno_cancelado__id",
        "turno_ofrecido__id",
    )
    readonly_fields = (
        "token",
        "fecha_envio",
    )


@admin.register(HistorialTurno)
class HistorialTurnoAdmin(admin.ModelAdmin):
    """Administración de Historial de Turnos"""

    list_display = [
        "id",
        "turno_link",
        "usuario_nombre",
        "accion",
        "cambio_estado",
        "created_at_formateado",
    ]

    list_filter = ["accion", "estado_nuevo", "created_at", "usuario"]

    search_fields = [
        "turno__cliente__user__first_name",
        "turno__cliente__user__last_name",
        "usuario__first_name",
        "usuario__last_name",
        "observaciones",
    ]

    readonly_fields = [
        "turno",
        "usuario",
        "accion",
        "estado_anterior",
        "estado_nuevo",
        "observaciones",
        "created_at",
    ]

    fieldsets = (
        (
            "Información del Cambio",
            {
                "fields": (
                    "turno",
                    "usuario",
                    "accion",
                )
            },
        ),
        (
            "Cambio de Estado",
            {
                "fields": (
                    "estado_anterior",
                    "estado_nuevo",
                )
            },
        ),
        (
            "Detalles",
            {
                "fields": (
                    "observaciones",
                    "created_at",
                )
            },
        ),
    )

    date_hierarchy = "created_at"

    ordering = ["-created_at"]

    list_per_page = 50

    def has_add_permission(self, request):
        """No permitir agregar historiales manualmente"""
        return False

    def has_delete_permission(self, request, obj=None):
        """No permitir eliminar historiales"""
        return False

    def turno_link(self, obj):
        """Link al turno relacionado"""
        if obj.turno:
            try:
                url = reverse("admin:turnos_turno_change", args=[obj.turno.pk])
                return format_html('<a href="{}">{}</a>', url, str(obj.turno))
            except:
                return str(obj.turno)
        return "-"

    turno_link.short_description = "Turno"

    def usuario_nombre(self, obj):
        """Nombre del usuario que realizó el cambio"""
        return obj.usuario.full_name if obj.usuario else "-"

    usuario_nombre.short_description = "Usuario"
    usuario_nombre.admin_order_field = "usuario"

    def cambio_estado(self, obj):
        """Visualización del cambio de estado"""
        if obj.estado_anterior and obj.estado_nuevo:
            return format_html(
                '<span style="color: #666;">{}</span> → <span style="color: #2196F3; font-weight: bold;">{}</span>',
                obj.estado_anterior.upper(),
                obj.estado_nuevo.upper(),
            )
        elif obj.estado_nuevo:
            return format_html(
                '<span style="color: #4CAF50; font-weight: bold;">Nuevo: {}</span>',
                obj.estado_nuevo.upper(),
            )
        return "-"

    cambio_estado.short_description = "Cambio de Estado"

    def created_at_formateado(self, obj):
        """Formato amigable de fecha"""
        return obj.created_at.strftime("%d/%m/%Y %H:%M:%S")

    created_at_formateado.short_description = "Fecha del Cambio"
    created_at_formateado.admin_order_field = "created_at"

    def get_queryset(self, request):
        """Optimizar consultas"""
        qs = super().get_queryset(request)
        return qs.select_related(
            "turno__cliente__user",
            "turno__empleado__user",
            "turno__servicio",
            "usuario",
        )
