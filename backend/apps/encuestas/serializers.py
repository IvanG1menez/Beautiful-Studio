"""Serializers para la app de encuestas"""

from rest_framework import serializers
from .models import Encuesta, EncuestaConfig, EncuestaPregunta, RespuestaCliente


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
    """Serializer para crear una encuesta (respuesta del cliente con sistema dinámico)"""
    
    respuestas = serializers.ListField(
        child=serializers.DictField(child=serializers.IntegerField()),
        write_only=True,
        help_text="Lista de respuestas: [{'pregunta_id': 1, 'valor': 8}, ...]"
    )
    
    class Meta:
        model = Encuesta
        fields = [
            'turno',
            'respuestas',
        ]
    
    def validate_turno(self, value):
        """Validar que el turno esté completado y no tenga encuesta"""
        if value.estado != 'completado':
            raise serializers.ValidationError("Solo se pueden evaluar turnos completados")
        
        if hasattr(value, 'encuesta'):
            raise serializers.ValidationError("Este turno ya tiene una encuesta asociada")
        
        return value
    
    def create(self, validated_data):
        """Crear encuesta con respuestas dinámicas"""
        from django.db import transaction
        
        turno = validated_data['turno']
        respuestas_data = validated_data['respuestas']
        
        with transaction.atomic():
            # Crear encuesta
            encuesta = Encuesta.objects.create(
                turno=turno,
                puntaje=0,  # Se calculará con respuestas
            )
            
            # Crear respuestas individuales
            for respuesta_data in respuestas_data:
                pregunta_id = respuesta_data['pregunta_id']
                valor = respuesta_data['valor']
                
                pregunta = EncuestaPregunta.objects.get(id=pregunta_id)
                RespuestaCliente.objects.create(
                    encuesta=encuesta,
                    pregunta=pregunta,
                    respuesta_valor=valor
                )
            
            # Calcular puntaje y clasificar
            encuesta.calcular_puntaje_promedio()
            encuesta.clasificar()
            encuesta.save()
            
            # Procesamiento asíncrono
            from .tasks import procesar_resultado_encuesta
            try:
                procesar_resultado_encuesta.delay(encuesta.id)
            except AttributeError:
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
            'puntaje',
            'clasificacion',
            'clasificacion_display',
            'fecha_respuesta',
        ]
        read_only_fields = ['id', 'clasificacion', 'fecha_respuesta']
    
    def get_cliente(self, obj):
        cliente = obj.turno.cliente if obj.turno else None
        if cliente:
            return {
                'id': cliente.id,
                'nombre': cliente.nombre_completo,
                'email': cliente.user.email,
            }
        return None
    
    def get_empleado(self, obj):
        empleado = obj.turno.empleado if obj.turno else None
        if empleado:
            return {
                'id': empleado.id,
                'nombre': empleado.nombre_completo,
            }
        return None
    
    def get_servicio(self, obj):
        if obj.turno:
            return {
                'nombre': obj.turno.servicio.nombre,
                'categoria': obj.turno.servicio.categoria.nombre,
            }
        return None


class EncuestaDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para una encuesta con todas las respuestas"""
    
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
            'respuestas_detalle',
            'puntaje',
            'clasificacion',
            'clasificacion_display',
            'fecha_respuesta',
            'created_at',
            'updated_at',
        ]
    
    def get_cliente(self, obj):
        cliente = obj.turno.cliente if obj.turno else None
        if cliente:
            return {
                'id': cliente.id,
                'nombre_completo': cliente.nombre_completo,
                'email': cliente.user.email,
            }
        return None
    
    def get_empleado(self, obj):
        empleado = obj.turno.empleado if obj.turno else None
        if empleado:
            return {
                'id': empleado.id,
                'nombre_completo': empleado.nombre_completo,
                'promedio_calificacion': float(empleado.promedio_calificacion),
                'total_encuestas': empleado.total_encuestas,
            }
        return None
    
    def get_turno_info(self, obj):
        if obj.turno:
            return {
                'id': obj.turno.id,
                'servicio': obj.turno.servicio.nombre,
                'fecha_hora': obj.turno.fecha_hora,
                'precio_final': float(obj.turno.precio_final) if obj.turno.precio_final else None,
            }
        return None


# ==========================================
# SERIALIZERS PARA SISTEMA PARAMETRIZADO
# ==========================================

class EncuestaPreguntaSerializer(serializers.ModelSerializer):
    """Serializer para gestión de preguntas dinámicas"""
    
    class Meta:
        model = EncuestaPregunta
        fields = [
            'id',
            'texto',
            'puntaje_maximo',
            'orden',
            'is_active',
            'categoria',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_orden(self, value):
        """Validar que el orden sea positivo"""
        if value < 1:
            raise serializers.ValidationError("El orden debe ser mayor a 0")
        return value


class RespuestaClienteSerializer(serializers.ModelSerializer):
    """Serializer para respuestas individuales a preguntas"""
    
    pregunta_texto = serializers.CharField(source='pregunta.texto', read_only=True)
    pregunta_puntaje_maximo = serializers.IntegerField(source='pregunta.puntaje_maximo', read_only=True)
    
    class Meta:
        model = RespuestaCliente
        fields = [
            'id',
            'pregunta',
            'pregunta_texto',
            'pregunta_puntaje_maximo',
            'respuesta_valor',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
    
    def validate(self, data):
        """Validar que el valor no supere el máximo de la pregunta"""
        pregunta = data.get('pregunta')
        respuesta_valor = data.get('respuesta_valor')
        
        if respuesta_valor > pregunta.puntaje_maximo:
            raise serializers.ValidationError({
                'respuesta_valor': f"El valor {respuesta_valor} supera el máximo permitido ({pregunta.puntaje_maximo})"
            })
        
        return data


class EncuestaRespuestaSerializer(serializers.ModelSerializer):
    """
    Serializer para crear encuestas con sistema parametrizado.
    Acepta un array de respuestas a preguntas dinámicas.
    """
    
    respuestas = RespuestaClienteSerializer(many=True, write_only=True)
    respuestas_detalle = RespuestaClienteSerializer(many=True, read_only=True, source='respuestas')
    cliente_info = serializers.SerializerMethodField(read_only=True)
    empleado_info = serializers.SerializerMethodField(read_only=True)
    clasificacion_display = serializers.CharField(source='get_clasificacion_display', read_only=True)
    
    class Meta:
        model = Encuesta
        fields = [
            'id',
            'turno',
            'cliente_info',
            'empleado_info',
            'respuestas',
            'respuestas_detalle',
            'puntaje',
            'clasificacion',
            'clasificacion_display',
            'fecha_respuesta',
        ]
        read_only_fields = ['id', 'puntaje', 'clasificacion', 'fecha_respuesta']
    
    def get_cliente_info(self, obj):
        cliente = obj.turno.cliente if obj.turno else None
        if cliente:
            return {
                'id': cliente.id,
                'nombre': cliente.nombre_completo,
            }
        return None
    
    def get_empleado_info(self, obj):
        empleado = obj.turno.empleado if obj.turno else None
        if empleado:
            return {
                'id': empleado.id,
                'nombre': empleado.nombre_completo,
                'promedio_calificacion': float(empleado.promedio_calificacion),
                'total_encuestas': empleado.total_encuestas,
            }
        return None
    
    def validate_turno(self, value):
        """Validar que el turno esté completado y no tenga encuesta"""
        if value.estado != 'completado':
            raise serializers.ValidationError("Solo se pueden evaluar turnos completados")
        
        if hasattr(value, 'encuesta'):
            raise serializers.ValidationError("Este turno ya tiene una encuesta asociada")
        
        return value
    
    def validate_respuestas(self, value):
        """Validar que haya al menos una respuesta y que no haya duplicados"""
        if not value:
            raise serializers.ValidationError("Debe proporcionar al menos una respuesta")
        
        # Verificar que no haya preguntas duplicadas
        preguntas_ids = [r['pregunta'].id for r in value]
        if len(preguntas_ids) != len(set(preguntas_ids)):
            raise serializers.ValidationError("No puede responder la misma pregunta dos veces")
        
        return value
    
    def create(self, validated_data):
        """Crear encuesta con respuestas en transacción atómica"""
        from django.db import transaction
        
        respuestas_data = validated_data.pop('respuestas')
        turno = validated_data['turno']
        
        with transaction.atomic():
            # Crear encuesta
            encuesta = Encuesta.objects.create(
                turno=turno,
                puntaje=0,  # Se calculará después
            )
            
            # Crear respuestas individuales
            total_puntos = 0
            total_maximo = 0
            
            for respuesta_data in respuestas_data:
                RespuestaCliente.objects.create(
                    encuesta=encuesta,
                    pregunta=respuesta_data['pregunta'],
                    respuesta_valor=respuesta_data['respuesta_valor']
                )
                
                # Acumular para calcular puntaje promedio
                total_puntos += respuesta_data['respuesta_valor']
                total_maximo += respuesta_data['pregunta'].puntaje_maximo
            
            # Calcular puntaje normalizado a escala 0-10
            if total_maximo > 0:
                encuesta.puntaje = round((total_puntos / total_maximo) * 10, 2)
            
            # Clasificar la encuesta
            encuesta.clasificar()
            encuesta.save()
            
            # Procesamiento asíncrono con Celery
            from .tasks import procesar_resultado_encuesta
            try:
                procesar_resultado_encuesta.delay(encuesta.id)
            except AttributeError:
                procesar_resultado_encuesta(encuesta.id)
        
        return encuesta
