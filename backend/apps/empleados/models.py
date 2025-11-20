"""Modelos para la app de profesionales"""

from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class Empleado(models.Model):
    """
    Información de profesionales del salón.
    Nota: El nombre de la clase se mantiene como 'Empleado' por compatibilidad
    con la base de datos, pero representa a los profesionales del salón.
    """

    ESPECIALIDAD_CHOICES = [
        ("corte", "Especialista en Corte"),
        ("color", "Colorista"),
        ("tratamientos", "Especialista en Tratamientos"),
        ("unas", "Manicurista/Pedicurista"),
        ("maquillaje", "Maquillador/a"),
        ("general", "Generalista"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profesional_profile",
        verbose_name="Usuario",
    )
    especialidades = models.CharField(
        max_length=20,
        choices=ESPECIALIDAD_CHOICES,
        verbose_name="Especialidad principal",
    )
    fecha_ingreso = models.DateField(verbose_name="Fecha de ingreso")
    horario_entrada = models.TimeField(verbose_name="Hora de entrada")
    horario_salida = models.TimeField(verbose_name="Hora de salida")
    dias_trabajo = models.CharField(
        max_length=20,
        help_text="Días de la semana (ej: L,M,M,J,V)",
        verbose_name="Días de trabajo",
    )
    comision_porcentaje = models.DecimalField(
        max_digits=5, decimal_places=2, default=0, verbose_name="Comisión (%)"
    )
    is_disponible = models.BooleanField(
        default=True, verbose_name="Disponible para turnos"
    )
    biografia = models.TextField(
        blank=True, null=True, verbose_name="Biografía profesional"
    )
    
    # Campos de ranking y métricas (Módulo Inteligente)
    promedio_calificacion = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=5.0,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        verbose_name="Promedio de calificación",
        help_text="Promedio de todas las encuestas recibidas (0-10)"
    )
    total_encuestas = models.PositiveIntegerField(
        default=0,
        verbose_name="Total de encuestas",
        help_text="Número total de encuestas respondidas"
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Fecha de creación"
    )
    updated_at = models.DateTimeField(
        auto_now=True, verbose_name="Fecha de actualización"
    )

    class Meta:
        verbose_name = "Profesional"
        verbose_name_plural = "Profesionales"
        ordering = ["user__first_name", "user__last_name"]

    def __str__(self):
        try:
            especialidad = self.get_especialidades_display()
            return f"{self.user.full_name} - {especialidad}"
        except AttributeError:
            return f"Profesional #{self.pk}"

    @property
    def nombre_completo(self):
        try:
            return self.user.full_name
        except AttributeError:
            return "Nombre no disponible"

    @property
    def email(self):
        try:
            return self.user.email
        except AttributeError:
            return "Email no disponible"


class EmpleadoServicio(models.Model):
    """
    Relación muchos a muchos entre profesionales y servicios que pueden realizar.
    Nota: El nombre de la clase se mantiene como 'EmpleadoServicio' por
    compatibilidad con la base de datos.
    """

    empleado = models.ForeignKey(
        Empleado, on_delete=models.CASCADE, related_name="servicios_disponibles"
    )
    servicio = models.ForeignKey(
        "servicios.Servicio",
        on_delete=models.CASCADE,
        related_name="profesionales_disponibles",
        verbose_name="Servicio",
    )
    nivel_experiencia = models.IntegerField(
        choices=[
            (1, "Principiante"),
            (2, "Intermedio"),
            (3, "Avanzado"),
            (4, "Experto"),
        ],
        default=2,
        verbose_name="Nivel de experiencia",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("empleado", "servicio")
        verbose_name = "Servicio de Profesional"
        verbose_name_plural = "Servicios de Profesionales"

    def __str__(self):
        try:
            return f"{self.empleado.nombre_completo} - {self.servicio.nombre}"
        except AttributeError:
            return f"ProfesionalServicio #{self.pk}"


class HorarioEmpleado(models.Model):
    """
    Horarios detallados de trabajo de profesionales por día de la semana.
    Permite múltiples rangos horarios por día.
    Nota: El nombre de la clase se mantiene como 'HorarioEmpleado' por
    compatibilidad con la base de datos.
    """

    DIA_SEMANA_CHOICES = [
        (0, "Lunes"),
        (1, "Martes"),
        (2, "Miércoles"),
        (3, "Jueves"),
        (4, "Viernes"),
        (5, "Sábado"),
        (6, "Domingo"),
    ]

    empleado = models.ForeignKey(
        Empleado,
        on_delete=models.CASCADE,
        related_name="horarios_detallados",
        verbose_name="Profesional",
    )
    dia_semana = models.IntegerField(
        choices=DIA_SEMANA_CHOICES, verbose_name="Día de la semana"
    )
    hora_inicio = models.TimeField(verbose_name="Hora de inicio")
    hora_fin = models.TimeField(verbose_name="Hora de fin")
    is_active = models.BooleanField(default=True, verbose_name="Activo")
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Fecha de creación"
    )
    updated_at = models.DateTimeField(
        auto_now=True, verbose_name="Fecha de actualización"
    )

    class Meta:
        verbose_name = "Horario de Profesional"
        verbose_name_plural = "Horarios de Profesionales"
        ordering = ["empleado", "dia_semana", "hora_inicio"]
        unique_together = [["empleado", "dia_semana", "hora_inicio"]]

    def __str__(self):
        dia = self.get_dia_semana_display()
        return f"{self.empleado.nombre_completo} - {dia} ({self.hora_inicio.strftime('%H:%M')} - {self.hora_fin.strftime('%H:%M')})"

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.hora_inicio >= self.hora_fin:
            raise ValidationError("La hora de inicio debe ser menor a la hora de fin")
