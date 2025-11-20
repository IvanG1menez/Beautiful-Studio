from rest_framework import serializers
from .models import NotificacionConfig, Notificacion


class NotificacionConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificacionConfig
        fields = [
            'id',
            # Notificaciones en plataforma
            'notificar_solicitud_turno',
            'notificar_pago_turno',
            'notificar_cancelacion_turno',
            'notificar_modificacion_turno',
            'notificar_nuevo_empleado',
            'notificar_nuevo_cliente',
            'notificar_reporte_diario',
            # Control de emails
            'email_solicitud_turno',
            'email_pago_turno',
            'email_cancelacion_turno',
            'email_modificacion_turno',
            'email_recordatorio_turno',
            'email_reporte_diario',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class NotificacionSerializer(serializers.ModelSerializer):
    tiempo_transcurrido = serializers.SerializerMethodField()
    
    class Meta:
        model = Notificacion
        fields = [
            'id',
            'tipo',
            'titulo',
            'mensaje',
            'leida',
            'data',
            'created_at',
            'leida_at',
            'tiempo_transcurrido',
        ]
        read_only_fields = ['id', 'created_at', 'leida_at']
    
    def get_tiempo_transcurrido(self, obj):
        """Retorna tiempo transcurrido desde la creación en formato legible"""
        from django.utils import timezone
        delta = timezone.now() - obj.created_at
        
        if delta.days > 0:
            return f"hace {delta.days} día{'s' if delta.days > 1 else ''}"
        elif delta.seconds >= 3600:
            horas = delta.seconds // 3600
            return f"hace {horas} hora{'s' if horas > 1 else ''}"
        elif delta.seconds >= 60:
            minutos = delta.seconds // 60
            return f"hace {minutos} minuto{'s' if minutos > 1 else ''}"
        else:
            return "hace unos momentos"
