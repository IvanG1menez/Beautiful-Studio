"""Modelos para la app de empleados"""
from django.db import models
from django.conf import settings


class Empleado(models.Model):
    """
    Información de empleados/profesionales del salón
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
        related_name="empleado_profile",
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
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Fecha de creación"
    )
    updated_at = models.DateTimeField(
        auto_now=True, verbose_name="Fecha de actualización"
    )

    class Meta:
        verbose_name = "Empleado"
        verbose_name_plural = "Empleados"
        ordering = ["user__first_name", "user__last_name"]

    def __str__(self):
        try:
            especialidad = self.get_especialidades_display()
            return f"{self.user.full_name} - {especialidad}"
        except AttributeError:
            return f"Empleado #{self.pk}"

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
    Relación muchos a muchos entre empleados y servicios que pueden realizar
    """

    empleado = models.ForeignKey(
        Empleado,
        on_delete=models.CASCADE,
        related_name="servicios_disponibles"
    )
    servicio = models.ForeignKey(
        "servicios.Servicio",
        on_delete=models.CASCADE,
        related_name="empleados_disponibles",
    )
    nivel_experiencia = models.IntegerField(
        choices=[
            (1, "Principiante"),
            (2, "Intermedio"),
            (3, "Avanzado"),
            (4, "Experto"),
        ],
        default=2,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("empleado", "servicio")
        verbose_name = "Servicio de Empleado"
        verbose_name_plural = "Servicios de Empleados"

    def __str__(self):
        try:
            return f"{self.empleado.nombre_completo} - {self.servicio.nombre}"
        except AttributeError:
            return f"EmpleadoServicio #{self.pk}"
