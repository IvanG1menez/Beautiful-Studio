"""Modelos para la app de encuestas"""

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


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
    cliente = models.ForeignKey(
        'clientes.Cliente',
        on_delete=models.CASCADE,
        related_name='encuestas',
        verbose_name='Cliente',
        null=True,
        blank=True
    )
    empleado = models.ForeignKey(
        'empleados.Empleado',
        on_delete=models.CASCADE,
        related_name='encuestas',
        verbose_name='Profesional evaluado',
        null=True,
        blank=True
    )
    
    # 10 PREGUNTAS DE LA ENCUESTA (0-10 cada una)
    # 1. Calidad del servicio
    pregunta1_calidad_servicio = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        default=5,
        verbose_name="¿Qué tan satisfecho estás con la calidad del servicio?"
    )
    # 2. Profesionalismo
    pregunta2_profesionalismo = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        default=5,
        verbose_name="¿Cómo calificarías el profesionalismo del especialista?"
    )
    # 3. Puntualidad
    pregunta3_puntualidad = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        default=5,
        verbose_name="¿El servicio comenzó a tiempo?"
    )
    # 4. Limpieza
    pregunta4_limpieza = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        default=5,
        verbose_name="¿Cómo calificarías la limpieza e higiene del lugar?"
    )
    # 5. Atención al cliente
    pregunta5_atencion = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        default=5,
        verbose_name="¿Cómo fue la atención recibida?"
    )
    # 6. Resultado final
    pregunta6_resultado = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        default=5,
        verbose_name="¿Estás satisfecho con el resultado final?"
    )
    # 7. Relación calidad-precio
    pregunta7_precio = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        default=5,
        verbose_name="¿Consideras que el precio es justo?"
    )
    # 8. Comodidad
    pregunta8_comodidad = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        default=5,
        verbose_name="¿Te sentiste cómodo durante el servicio?"
    )
    # 9. Comunicación
    pregunta9_comunicacion = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        default=5,
        verbose_name="¿El especialista te explicó claramente el proceso?"
    )
    # 10. Recomendación
    pregunta10_recomendacion = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        default=5,
        verbose_name="¿Qué tan probable es que recomiendes este servicio?"
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
    
    # Comentario opcional
    comentario = models.TextField(
        blank=True,
        null=True,
        help_text="Comentarios adicionales del cliente"
    )
    
    # Control
    fecha_respuesta = models.DateTimeField(auto_now_add=True)
    procesada = models.BooleanField(
        default=False,
        help_text="Indica si ya se procesó para ranking y alertas"
    )
    alerta_enviada = models.BooleanField(
        default=False,
        help_text="Indica si se envió alerta al propietario"
    )
    
    # Metadatos
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Encuesta de Satisfacción"
        verbose_name_plural = "Encuestas de Satisfacción"
        ordering = ['-fecha_respuesta']
        indexes = [
            models.Index(fields=['empleado', 'clasificacion', 'fecha_respuesta']),
            models.Index(fields=['cliente', 'fecha_respuesta']),
        ]
    
    def __str__(self):
        return f"Encuesta {self.id} - {self.empleado.nombre_completo} ({self.puntaje}/10 - {self.get_clasificacion_display()})"
    
    def save(self, *args, **kwargs):
        """Calcular puntaje promedio y clasificar automáticamente"""
        self.calcular_puntaje_promedio()
        self.clasificar()
        super().save(*args, **kwargs)
    
    def calcular_puntaje_promedio(self):
        """Calcular el promedio de las 10 preguntas"""
        total = (
            self.pregunta1_calidad_servicio +
            self.pregunta2_profesionalismo +
            self.pregunta3_puntualidad +
            self.pregunta4_limpieza +
            self.pregunta5_atencion +
            self.pregunta6_resultado +
            self.pregunta7_precio +
            self.pregunta8_comodidad +
            self.pregunta9_comunicacion +
            self.pregunta10_recomendacion
        )
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
