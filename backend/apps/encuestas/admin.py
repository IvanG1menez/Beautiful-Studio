"""Admin para la app de encuestas"""

from django.contrib import admin
from django.utils.html import format_html
from .models import Encuesta, EncuestaConfig, EncuestaPregunta, RespuestaCliente


@admin.register(EncuestaConfig)
class EncuestaConfigAdmin(admin.ModelAdmin):
    """Admin para la configuración de encuestas"""
    
    list_display = [
        'id',
        'umbral_negativa',
        'umbral_neutral_min',
        'umbral_neutral_max',
        'umbral_notificacion_propietario',
        'dias_ventana_alerta',
        'activo',
    ]
    
    fieldsets = (
        ('Clasificación de Encuestas', {
            'fields': (
                'umbral_negativa',
                'umbral_neutral_min',
                'umbral_neutral_max',
            ),
            'description': 'Umbrales para clasificar encuestas como Negativa, Neutral o Positiva (0-10)'
        }),
        ('Sistema de Alertas Inteligente', {
            'fields': (
                'umbral_notificacion_propietario',
                'dias_ventana_alerta',
            ),
            'description': 'Configuración para alertas automáticas al propietario'
        }),
        ('Configuración de Email', {
            'fields': ('email_override_debug',),
            'description': 'Email que recibe notificaciones cuando DEBUG=True'
        }),
        ('Estado', {
            'fields': ('activo',),
        }),
    )
    
    def has_add_permission(self, request):
        # Solo permitir una configuración activa
        return not EncuestaConfig.objects.filter(activo=True).exists()
    
    def has_delete_permission(self, request, obj=None):
        # No permitir eliminar la configuración activa
        if obj and obj.activo:
            return False
        return True


@admin.register(Encuesta)
class EncuestaAdmin(admin.ModelAdmin):
    """Admin para encuestas con 10 preguntas"""
    
    list_display = [
        'id',
        'empleado',
        'cliente',
        'puntaje_promedio',
        'clasificacion_color',
        'fecha_respuesta',
        'procesada',
    ]
    
    list_filter = [
        'clasificacion',
        'procesada',
        'alerta_enviada',
        'fecha_respuesta',
        'empleado',
    ]
    
    search_fields = [
        'empleado__user__first_name',
        'empleado__user__last_name',
        'cliente__user__first_name',
        'cliente__user__last_name',
        'comentario',
    ]
    
    readonly_fields = [
        'puntaje',
        'clasificacion',
        'fecha_respuesta',
        'procesada',
        'alerta_enviada',
        'created_at',
        'updated_at',
        'ver_detalles_completos',
    ]
    
    fieldsets = (
        ('Información del Turno', {
            'fields': ('turno',)
        }),
        ('Partes Involucradas', {
            'fields': ('cliente', 'empleado')
        }),
        ('📊 Respuestas de la Encuesta (0-10)', {
            'fields': (
                'pregunta1_calidad_servicio',
                'pregunta2_profesionalismo',
                'pregunta3_puntualidad',
                'pregunta4_limpieza',
                'pregunta5_atencion',
                'pregunta6_resultado',
                'pregunta7_precio',
                'pregunta8_comodidad',
                'pregunta9_comunicacion',
                'pregunta10_recomendacion',
            ),
            'description': 'Respuestas del cliente a cada pregunta (escala 0-10)'
        }),
        ('💬 Comentario del Cliente', {
            'fields': ('comentario',),
            'classes': ('wide',)
        }),
        ('📈 Resultado Automático', {
            'fields': (
                'puntaje',
                'clasificacion',
            ),
            'description': 'Promedio calculado automáticamente y clasificación'
        }),
        ('🔧 Control Interno', {
            'fields': (
                'procesada',
                'alerta_enviada',
                'fecha_respuesta',
                'created_at',
                'updated_at',
            ),
            'classes': ('collapse',)
        }),
        ('📋 Vista Detallada', {
            'fields': ('ver_detalles_completos',),
            'classes': ('wide',)
        }),
    )
    
    def puntaje_promedio(self, obj):
        """Mostrar puntaje con formato"""
        return f"{obj.puntaje:.2f}/10"
    puntaje_promedio.short_description = "Promedio"
    
    def clasificacion_color(self, obj):
        """Mostrar clasificación con color"""
        colores = {
            'P': 'green',
            'Ne': 'orange',
            'N': 'red',
        }
        color = colores.get(obj.clasificacion, 'gray')
        return format_html(
            '<span style="color: {}; font-weight: bold;">● {}</span>',
            color,
            obj.get_clasificacion_display()
        )
    clasificacion_color.short_description = "Clasificación"
    
    def ver_detalles_completos(self, obj):
        """Mostrar todas las respuestas en formato tabla"""
        if not obj.id:
            return "Guarda la encuesta para ver los detalles"
        
        preguntas = [
            ("Calidad del servicio", obj.pregunta1_calidad_servicio),
            ("Profesionalismo", obj.pregunta2_profesionalismo),
            ("Puntualidad", obj.pregunta3_puntualidad),
            ("Limpieza e higiene", obj.pregunta4_limpieza),
            ("Atención al cliente", obj.pregunta5_atencion),
            ("Resultado final", obj.pregunta6_resultado),
            ("Relación calidad-precio", obj.pregunta7_precio),
            ("Comodidad", obj.pregunta8_comodidad),
            ("Comunicación", obj.pregunta9_comunicacion),
            ("Recomendación", obj.pregunta10_recomendacion),
        ]
        
        html = '<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">'
        html += '<thead><tr style="background-color: #f0f0f0;">'
        html += '<th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Pregunta</th>'
        html += '<th style="padding: 8px; text-align: center; border: 1px solid #ddd; width: 100px;">Puntaje</th>'
        html += '<th style="padding: 8px; text-align: left; border: 1px solid #ddd; width: 200px;">Barra</th>'
        html += '</tr></thead><tbody>'
        
        for pregunta, puntaje in preguntas:
            porcentaje = (puntaje / 10) * 100
            color = '#4caf50' if puntaje >= 8 else '#ff9800' if puntaje >= 5 else '#f44336'
            
            html += f'<tr>'
            html += f'<td style="padding: 8px; border: 1px solid #ddd;">{pregunta}</td>'
            html += f'<td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold;">{puntaje}/10</td>'
            html += f'<td style="padding: 8px; border: 1px solid #ddd;">'
            html += f'<div style="background-color: #e0e0e0; border-radius: 10px; overflow: hidden;">'
            html += f'<div style="background-color: {color}; width: {porcentaje}%; height: 20px; border-radius: 10px;"></div>'
            html += f'</div></td>'
            html += f'</tr>'
        
        html += '</tbody></table>'
        
        # Resumen
        html += f'<div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">'
        html += f'<h4 style="margin-top: 0;">📊 Resumen</h4>'
        html += f'<p><strong>Promedio General:</strong> <span style="font-size: 24px; color: #667eea;">{obj.puntaje:.2f}/10</span></p>'
        html += f'<p><strong>Clasificación:</strong> {obj.get_clasificacion_display()}</p>'
        if obj.comentario:
            html += f'<p><strong>Comentario:</strong> "{obj.comentario}"</p>'
        html += f'</div>'
        
        return format_html(html)
    ver_detalles_completos.short_description = "Detalles Completos"
    
    def get_readonly_fields(self, request, obj=None):
        if obj:  # Editando
            # No permitir cambiar turno, cliente, empleado una vez creada
            return self.readonly_fields + ['turno', 'cliente', 'empleado']
        return self.readonly_fields
    
    actions = ['reprocesar_encuestas']
    
    def reprocesar_encuestas(self, request, queryset):
        """Acción para reprocesar encuestas seleccionadas"""
        from .tasks import procesar_resultado_encuesta
        
        count = 0
        for encuesta in queryset:
            try:
                procesar_resultado_encuesta.delay(encuesta.id)
            except:
                procesar_resultado_encuesta(encuesta.id)
            count += 1
        
        self.message_user(
            request,
            f'{count} encuesta(s) enviada(s) para reprocesamiento.'
        )
    
    reprocesar_encuestas.short_description = "Reprocesar encuestas seleccionadas"


# ==========================================
# ADMIN PARA SISTEMA PARAMETRIZADO
# ==========================================

@admin.register(EncuestaPregunta)
class EncuestaPreguntaAdmin(admin.ModelAdmin):
    """Admin para gestionar preguntas dinámicas"""
    
    list_display = [
        'orden',
        'texto_corto',
        'puntaje_maximo',
        'categoria',
        'is_active',
        'created_at',
    ]
    
    list_filter = [
        'is_active',
        'categoria',
        'puntaje_maximo',
    ]
    
    search_fields = [
        'texto',
        'categoria',
    ]
    
    list_editable = [
        'is_active',
    ]
    
    ordering = ['orden', 'id']
    
    fieldsets = (
        ('Contenido de la Pregunta', {
            'fields': ('texto', 'categoria'),
        }),
        ('Configuración', {
            'fields': ('puntaje_maximo', 'orden', 'is_active'),
        }),
        ('Información', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    
    readonly_fields = ['created_at', 'updated_at']
    
    def texto_corto(self, obj):
        """Mostrar texto truncado"""
        if len(obj.texto) > 60:
            return f"{obj.texto[:60]}..."
        return obj.texto
    texto_corto.short_description = "Pregunta"


class RespuestaClienteInline(admin.TabularInline):
    """Inline para ver respuestas dentro de una encuesta"""
    model = RespuestaCliente
    extra = 0
    readonly_fields = ['pregunta', 'respuesta_valor', 'created_at']
    can_delete = False
    
    def has_add_permission(self, request, obj=None):
        return False


@admin.register(RespuestaCliente)
class RespuestaClienteAdmin(admin.ModelAdmin):
    """Admin para respuestas individuales"""
    
    list_display = [
        'id',
        'encuesta',
        'pregunta_texto_corto',
        'respuesta_valor',
        'created_at',
    ]
    
    list_filter = [
        'pregunta',
        'respuesta_valor',
        'created_at',
    ]
    
    search_fields = [
        'encuesta__cliente__user__first_name',
        'encuesta__empleado__user__first_name',
        'pregunta__texto',
    ]
    
    readonly_fields = ['encuesta', 'pregunta', 'respuesta_valor', 'created_at']
    
    def pregunta_texto_corto(self, obj):
        """Mostrar texto de pregunta truncado"""
        if len(obj.pregunta.texto) > 50:
            return f"{obj.pregunta.texto[:50]}..."
        return obj.pregunta.texto
    pregunta_texto_corto.short_description = "Pregunta"
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
