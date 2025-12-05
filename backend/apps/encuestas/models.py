"""Modelos para la app de encuestas"""

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from django.db import transaction


class EncuestaConfig(models.Model):
    """
    Configuración global del sistema de encuestas
    """
    # Parámetros de clasificación
    umbral_negativa = models.PositiveSmallIntegerField(
        default=4,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        help_text="Puntaje máximo para clasificar como 'Negativa' (<=)"
    )
    umbral_neutral_min = models.PositiveSmallIntegerField(
        default=5,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        help_text="Puntaje mínimo para clasificar como 'Neutral'"
    )
    umbral_neutral_max = models.PositiveSmallIntegerField(
        default=7,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        help_text="Puntaje máximo para clasificar como 'Neutral' (<=)"
    )
    # umbral_positiva >= 8 (implícito)
    
    # Parámetro de alerta inteligente
    umbral_notificacion_propietario = models.PositiveSmallIntegerField(
        default=3,
        validators=[MinValueValidator(1)],
        help_text="Número de encuestas negativas en 30 días que disparan alerta al propietario"
    )
    
    # Días para considerar encuestas recientes
    dias_ventana_alerta = models.PositiveSmallIntegerField(
        default=30,
        validators=[MinValueValidator(1)],
        help_text="Días hacia atrás para contar encuestas negativas"
    )
    
    # Email override para desarrollo
    email_override_debug = models.EmailField(
        default='gimenezivanb@gmail.com',
        help_text="Email que recibe todas las notificaciones cuando DEBUG=True"
    )
    
    # Metadatos
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Configuración de Encuestas"
        verbose_name_plural = "Configuración de Encuestas"
    
    def __str__(self):
        return f"Config Encuestas (Umbral negativa: <={self.umbral_negativa}, Alerta: {self.umbral_notificacion_propietario})"
    
    @classmethod
    def get_config(cls):
        """Obtener o crear la configuración activa"""
        config, created = cls.objects.get_or_create(
            activo=True,
            defaults={
                'umbral_negativa': 4,
                'umbral_neutral_min': 5,
                'umbral_neutral_max': 7,
                'umbral_notificacion_propietario': 3,
                'dias_ventana_alerta': 30,
            }
        )
        return config


class Encuesta(models.Model):
    """
    Encuesta de satisfacción post-servicio con 10 preguntas
    """
    CLASIFICACION_CHOICES = [
        ('N', 'Negativa'),
        ('Ne', 'Neutral'),
        ('P', 'Positiva'),
    ]
    
    # Relaciones
    turno = models.OneToOneField(
        'turnos.Turno',
        on_delete=models.CASCADE,
        related_name='encuesta',
        verbose_name='Turno asociado'
    )
    
    # Puntaje promedio calculado
    puntaje = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=5.0,
        help_text="Promedio de las 10 preguntas (calculado automáticamente)"
    )
    
    clasificacion = models.CharField(
        max_length=2,
        choices=CLASIFICACION_CHOICES,
        blank=True,
        default='Ne',
        help_text="Clasificación automática según puntaje promedio"
    )
    
    # Control
    fecha_respuesta = models.DateTimeField(auto_now_add=True)
    
    # Metadatos
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Encuesta de Satisfacción"
        verbose_name_plural = "Encuestas de Satisfacción"
        ordering = ['-fecha_respuesta']
        indexes = [
            models.Index(fields=['turno', 'clasificacion', 'fecha_respuesta']),
        ]
    
    def __str__(self):
        empleado = self.turno.empleado.nombre_completo if self.turno and self.turno.empleado else 'Sin empleado'
        return f"Encuesta {self.id} - {empleado} ({self.puntaje}/10 - {self.get_clasificacion_display()})"
    
    def save(self, *args, **kwargs):
        """Calcular puntaje promedio y clasificar automáticamente"""
        # Solo calcular si ya tiene ID (actualización) y no se está forzando skip
        skip_auto_calc = kwargs.pop('skip_auto_calculation', False)
        
        if not skip_auto_calc and self.pk:
            self.calcular_puntaje_promedio()
            self.clasificar()
        
        super().save(*args, **kwargs)
    
    def calcular_puntaje_promedio(self):
        """Calcular el promedio de las respuestas dinámicas"""
        respuestas = self.respuestas.all()
        if not respuestas.exists():
            self.puntaje = 5.0  # Valor por defecto
            return
        
        total = sum(r.respuesta_valor for r in respuestas)
        cantidad = respuestas.count()
        self.puntaje = round(total / cantidad, 2) if cantidad > 0 else 5.0
        self.puntaje = round(total / 10, 2)
    
    def clasificar(self):
        """Clasificar la encuesta según el puntaje promedio"""
        config = EncuestaConfig.get_config()
        
        if self.puntaje <= config.umbral_negativa:
            self.clasificacion = 'N'  # Negativa
        elif config.umbral_neutral_min <= self.puntaje <= config.umbral_neutral_max:
            self.clasificacion = 'Ne'  # Neutral
        else:
            self.clasificacion = 'P'  # Positiva


class EncuestaPregunta(models.Model):
    """
    Preguntas dinámicas configurables para el sistema de encuestas.
    Permite que el propietario personalice las preguntas sin modificar código.
    """
    texto = models.CharField(
        max_length=255,
        verbose_name="Texto de la pregunta",
        help_text="Pregunta que se mostrará al cliente"
    )
    puntaje_maximo = models.PositiveSmallIntegerField(
        default=10,
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        verbose_name="Puntaje máximo",
        help_text="Máximo puntaje que puede asignar el cliente (ej: 10)"
    )
    orden = models.PositiveSmallIntegerField(
        default=1,
        verbose_name="Orden de aparición",
        help_text="Orden en el que aparece en el formulario"
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="Activa",
        help_text="Si está activa se muestra en las encuestas nuevas"
    )
    categoria = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="Categoría",
        help_text="Categoría de la pregunta (ej: Servicio, Atención, Instalaciones)"
    )
    
    # Metadatos
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Pregunta de Encuesta"
        verbose_name_plural = "Preguntas de Encuesta"
        ordering = ['orden', 'id']
        indexes = [
            models.Index(fields=['is_active', 'orden']),
        ]
    
    def __str__(self):
        estado = "✓" if self.is_active else "✗"
        return f"[{self.orden}] {estado} {self.texto[:50]}..."


class RespuestaCliente(models.Model):
    """
    Respuestas individuales del cliente a cada pregunta de la encuesta.
    Modelo dinámico que se adapta a las preguntas configuradas.
    """
    encuesta = models.ForeignKey(
        'Encuesta',
        on_delete=models.CASCADE,
        related_name='respuestas',
        verbose_name='Encuesta'
    )
    pregunta = models.ForeignKey(
        'EncuestaPregunta',
        on_delete=models.PROTECT,  # Proteger para no perder historial
        related_name='respuestas',
        verbose_name='Pregunta'
    )
    respuesta_valor = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        verbose_name="Valor de la respuesta",
        help_text="Puntaje asignado por el cliente (0-10)"
    )
    
    # Metadatos
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Respuesta de Cliente"
        verbose_name_plural = "Respuestas de Clientes"
        unique_together = ['encuesta', 'pregunta']
        indexes = [
            models.Index(fields=['encuesta', 'pregunta']),
            models.Index(fields=['pregunta', 'respuesta_valor']),
        ]
    
    def __str__(self):
        return f"Encuesta {self.encuesta.id} - {self.pregunta.texto[:30]}... = {self.respuesta_valor}"
    
    def clean(self):
        """Validar que el valor no supere el puntaje máximo de la pregunta"""
        from django.core.exceptions import ValidationError
        if self.respuesta_valor > self.pregunta.puntaje_maximo:
            raise ValidationError(
                f"El valor {self.respuesta_valor} supera el máximo permitido ({self.pregunta.puntaje_maximo})"
            )
