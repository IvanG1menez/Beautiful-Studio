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
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            turno = validated_data['turno']
            respuestas_data = validated_data.pop('respuestas')
            
            logger.info(f"Creando encuesta para turno #{turno.id}")
            logger.info(f"Respuestas recibidas: {respuestas_data}")
            
            # Calcular puntaje promedio desde las respuestas
            valores = [r['valor'] for r in respuestas_data if 'valor' in r]
            puntaje_promedio = round(sum(valores) / len(valores), 2) if valores else 5.0
            
            logger.info(f"Puntaje calculado: {puntaje_promedio}")
            
            # Determinar clasificación manualmente
            if puntaje_promedio <= 4:
                clasificacion = 'N'  # Negativa
            elif 5 <= puntaje_promedio <= 7:
                clasificacion = 'Ne'  # Neutral
            else:
                clasificacion = 'P'  # Positiva
            
            logger.info(f"Clasificación: {clasificacion}")
            
            with transaction.atomic():
                # Crear encuesta directamente con todos los valores
                logger.info("Creando objeto Encuesta en BD...")
                # Usamos skip_auto_calculation porque ya calculamos el puntaje y clasificación manualmente
                encuesta = Encuesta(
                    turno=turno,
                    puntaje=puntaje_promedio,
                    clasificacion=clasificacion
                )
                encuesta.save(skip_auto_calculation=True)
                logger.info(f"Encuesta creada con ID: {encuesta.id}")
                
                # Intentar crear respuestas individuales si existen las preguntas
                for respuesta_data in respuestas_data:
                    pregunta_id = respuesta_data.get('pregunta_id')
                    valor = respuesta_data.get('valor')
                    
                    if pregunta_id and valor is not None:
                        try:
                            pregunta = EncuestaPregunta.objects.get(id=pregunta_id)
                            RespuestaCliente.objects.create(
                                encuesta=encuesta,
                                pregunta=pregunta,
                                respuesta_valor=valor
                            )
                            logger.info(f"Respuesta creada para pregunta #{pregunta_id}")
                        except EncuestaPregunta.DoesNotExist:
                            logger.warning(f"Pregunta #{pregunta_id} no existe, omitiendo")
                            continue
                
                logger.info("Intentando procesamiento asíncrono...")
                # Procesamiento asíncrono - solo si Celery está disponible
                try:
                    from django.conf import settings
                    if hasattr(settings, 'CELERY_BROKER_URL'):
                        from .tasks import procesar_resultado_encuesta
                        procesar_resultado_encuesta.delay(encuesta.id)
                        logger.info("Tarea asíncrona encolada")
                except Exception as e:
                    logger.warning(f"No se pudo encolar tarea asíncrona: {e}")
                    # No es crítico, continuar sin procesar
                    pass
            
            logger.info(f"Encuesta #{encuesta.id} creada exitosamente")
            return encuesta
            
        except Exception as e:
            logger.error(f"Error creando encuesta: {str(e)}", exc_info=True)
            raise
        
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
    respuestas_detalle = serializers.SerializerMethodField()
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
    
    def get_respuestas_detalle(self, obj):
        """Devuelve las respuestas individuales con información de la pregunta"""
        respuestas = obj.respuestas.select_related('pregunta').all()
        return [
            {
                'pregunta_id': respuesta.pregunta.id,
                'pregunta_texto': respuesta.pregunta.texto,
                'categoria': respuesta.pregunta.categoria,
                'valor': respuesta.respuesta_valor,
                'puntaje_maximo': respuesta.pregunta.puntaje_maximo,
            }
            for respuesta in respuestas
        ]


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
            # Calcular puntaje antes de crear la encuesta
            total_puntos = 0
            total_maximo = 0
            
            for respuesta_data in respuestas_data:
                total_puntos += respuesta_data['respuesta_valor']
                total_maximo += respuesta_data['pregunta'].puntaje_maximo
            
            # Calcular puntaje normalizado a escala 0-10
            puntaje_calculado = round((total_puntos / total_maximo) * 10, 2) if total_maximo > 0 else 5.0
            
            # Determinar clasificación manualmente
            if puntaje_calculado <= 4:
                clasificacion = 'N'  # Negativa
            elif 5 <= puntaje_calculado <= 7:
                clasificacion = 'Ne'  # Neutral
            else:
                clasificacion = 'P'  # Positiva
            
            # Crear encuesta con todos los valores calculados
            encuesta = Encuesta(
                turno=turno,
                puntaje=puntaje_calculado,
                clasificacion=clasificacion
            )
            encuesta.save(skip_auto_calculation=True)
            
            # Crear respuestas individuales
            for respuesta_data in respuestas_data:
                RespuestaCliente.objects.create(
                    encuesta=encuesta,
                    pregunta=respuesta_data['pregunta'],
                    respuesta_valor=respuesta_data['respuesta_valor']
                )
            
            # Procesamiento asíncrono - solo si Celery está disponible
            try:
                from django.conf import settings
                if hasattr(settings, 'CELERY_BROKER_URL'):
                    from .tasks import procesar_resultado_encuesta
                    procesar_resultado_encuesta.delay(encuesta.id)
            except Exception:
                # No es crítico, continuar sin procesar
                pass
        
        return encuesta
