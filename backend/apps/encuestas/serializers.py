"""Serializers para la app de encuestas"""

from rest_framework import serializers
from .models import Encuesta, EncuestaConfig


class EncuestaConfigSerializer(serializers.ModelSerializer):
    """Serializer para la configuración de encuestas"""
    
    class Meta:
        model = EncuestaConfig
        fields = [
            'id',
            'umbral_negativa',
            'umbral_neutral_min',
            'umbral_neutral_max',
            'umbral_notificacion_propietario',
            'dias_ventana_alerta',
            'activo',
        ]
        read_only_fields = ['id']


class EncuestaCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear una encuesta (respuesta del cliente con 10 preguntas)"""
    
    class Meta:
        model = Encuesta
        fields = [
            'turno',
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
            'comentario',
        ]
    
    def validate_turno(self, value):
        """Validar que el turno esté completado y no tenga encuesta"""
        if value.estado != 'completado':
            raise serializers.ValidationError("Solo se pueden evaluar turnos completados")
        
        if hasattr(value, 'encuesta'):
            raise serializers.ValidationError("Este turno ya tiene una encuesta asociada")
        
        return value
    
    def create(self, validated_data):
        """Crear encuesta y disparar procesamiento"""
        turno = validated_data['turno']
        
        # Crear encuesta con datos relacionados
        encuesta = Encuesta.objects.create(
            turno=turno,
            cliente=turno.cliente,
            empleado=turno.empleado,
            pregunta1_calidad_servicio=validated_data['pregunta1_calidad_servicio'],
            pregunta2_profesionalismo=validated_data['pregunta2_profesionalismo'],
            pregunta3_puntualidad=validated_data['pregunta3_puntualidad'],
            pregunta4_limpieza=validated_data['pregunta4_limpieza'],
            pregunta5_atencion=validated_data['pregunta5_atencion'],
            pregunta6_resultado=validated_data['pregunta6_resultado'],
            pregunta7_precio=validated_data['pregunta7_precio'],
            pregunta8_comodidad=validated_data['pregunta8_comodidad'],
            pregunta9_comunicacion=validated_data['pregunta9_comunicacion'],
            pregunta10_recomendacion=validated_data['pregunta10_recomendacion'],
            comentario=validated_data.get('comentario', '')
        )
        
        # Procesamiento síncrono (TODO: implementar Celery para asíncrono)
        from .tasks import procesar_resultado_encuesta
        procesar_resultado_encuesta(encuesta.id)
        
        return encuesta


class EncuestaListSerializer(serializers.ModelSerializer):
    """Serializer para listar encuestas"""
    
    cliente = serializers.SerializerMethodField()
    empleado = serializers.SerializerMethodField()
    servicio = serializers.SerializerMethodField()
    clasificacion_display = serializers.CharField(source='get_clasificacion_display', read_only=True)
    
    class Meta:
        model = Encuesta
        fields = [
            'id',
            'turno',
            'cliente',
            'empleado',
            'servicio',
            # 10 preguntas
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
            # Resultado
            'puntaje',
            'clasificacion',
            'clasificacion_display',
            'comentario',
            'fecha_respuesta',
            'procesada',
            'alerta_enviada',
        ]
        read_only_fields = ['id', 'clasificacion', 'fecha_respuesta', 'procesada', 'alerta_enviada']
    
    def get_cliente(self, obj):
        return {
            'id': obj.cliente.id,
            'nombre': obj.cliente.nombre_completo,
            'email': obj.cliente.user.email,
        }
    
    def get_empleado(self, obj):
        return {
            'id': obj.empleado.id,
            'nombre': obj.empleado.nombre_completo,
            'especialidad': obj.empleado.get_especialidades_display(),
        }
    
    def get_servicio(self, obj):
        return {
            'nombre': obj.turno.servicio.nombre,
            'categoria': obj.turno.servicio.categoria.nombre,
        }


class EncuestaDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para una encuesta con todas las respuestas"""
    
    cliente = serializers.SerializerMethodField()
    empleado = serializers.SerializerMethodField()
    turno_info = serializers.SerializerMethodField()
    clasificacion_display = serializers.CharField(source='get_clasificacion_display', read_only=True)
    
    class Meta:
        model = Encuesta
        fields = [
            'id',
            'turno',
            'turno_info',
            'cliente',
            'empleado',
            # 10 preguntas
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
            # Resultado
            'puntaje',
            'clasificacion',
            'clasificacion_display',
            'comentario',
            'fecha_respuesta',
            'procesada',
            'alerta_enviada',
            'created_at',
            'updated_at',
        ]
    
    def get_cliente(self, obj):
        return {
            'id': obj.cliente.id,
            'nombre_completo': obj.cliente.nombre_completo,
            'email': obj.cliente.user.email,
        }
    
    def get_empleado(self, obj):
        return {
            'id': obj.empleado.id,
            'nombre_completo': obj.empleado.nombre_completo,
            'especialidad': obj.empleado.get_especialidades_display(),
            'promedio_calificacion': float(obj.empleado.promedio_calificacion),
            'total_encuestas': obj.empleado.total_encuestas,
        }
    
    def get_turno_info(self, obj):
        return {
            'id': obj.turno.id,
            'servicio': obj.turno.servicio.nombre,
            'fecha_hora': obj.turno.fecha_hora,
            'precio_final': float(obj.turno.precio_final) if obj.turno.precio_final else None,
        }
