"""Modelos para la app de turnos"""

from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone


class Turno(models.Model):
    """
    Sistema de gestión de turnos/citas
    """

    ESTADO_CHOICES = [
        ("pendiente", "Pendiente"),
        ("confirmado", "Confirmado"),
        ("en_proceso", "En Proceso"),
        ("completado", "Completado"),
        ("cancelado", "Cancelado"),
        ("no_asistio", "No Asistió"),
    ]
    """ Relación con otros modelos """
    cliente = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.CASCADE,
        related_name="turnos",
        verbose_name="Cliente",
    )
    empleado = models.ForeignKey(
        "empleados.Empleado",
        on_delete=models.CASCADE,
        related_name="turnos",
        verbose_name="Empleado",
    )
    servicio = models.ForeignKey(
        "servicios.Servicio",
        on_delete=models.CASCADE,
        related_name="turnos",
        verbose_name="Servicio",
    )
    fecha_hora = models.DateTimeField(verbose_name="Fecha y hora")
    estado = models.CharField(
        max_length=15,
        choices=ESTADO_CHOICES,
        default="pendiente",
        verbose_name="Estado",
    )
    notas_cliente = models.TextField(
        blank=True, null=True, verbose_name="Notas del cliente"
    )
    notas_empleado = models.TextField(
        blank=True, null=True, verbose_name="Notas del empleado"
    )
    precio_final = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        verbose_name="Precio final",
    )
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Fecha de creación"
    )
    updated_at = models.DateTimeField(
        auto_now=True, verbose_name="Fecha de actualización"
    )

    class Meta:
        """Meta datos del modelo"""

        verbose_name = "Turno"
        verbose_name_plural = "Turnos"
        ordering = ["-fecha_hora"]
        unique_together = (
            "empleado",
            "fecha_hora",
        )  # Un empleado no puede tener dos turnos a la misma hora

    def __str__(self):
        try:
            cliente_nombre = (
                (
                    self.cliente.nombre_completo
                    if self.cliente
                    else "Cliente desconocido"
                )
            )
            servicio_nombre = (
                self.servicio.nombre
                if self.servicio
                else "Servicio desconocido"
            )
            fecha_str = (
                self.fecha_hora.strftime("%d/%m/%Y %H:%M")
                if self.fecha_hora
                else "Sin fecha"
            )
            return f"{cliente_nombre} - {servicio_nombre} - {fecha_str}"
        except AttributeError:
            return f"Turno #{self.pk}"

    def clean(self):
        """Validaciones personalizadas"""
        if self.fecha_hora and self.fecha_hora < timezone.now():
            raise ValidationError(
                "No se puede programar un turno en el pasado."
            )

    @property
    def fecha_hora_fin(self):
        """Calcula la hora de finalización del turno"""
        if self.fecha_hora and self.servicio:
            from datetime import timedelta

            duracion = self.servicio.duracion_minutos
            return self.fecha_hora + timedelta(minutes=duracion)
        return None

    @property
    def duracion(self):
        """Retorna la duración del servicio"""
        return self.servicio.duracion_horas if self.servicio else None

    def puede_cancelar(self):
        """Verifica si el turno puede ser cancelado"""
        if self.estado in ["completado", "cancelado", "no_asistio"]:
            return False
        # No se puede cancelar si falta menos de 2 horas
        from datetime import timedelta

        limite_cancelacion = self.fecha_hora - timedelta(hours=2)
        return timezone.now() < limite_cancelacion


class HistorialTurno(models.Model):
    """
    Historial de cambios en los turnos
    """

    turno = models.ForeignKey(
        Turno, on_delete=models.CASCADE, related_name="historial"
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        verbose_name="Usuario que realizó el cambio",
    )
    accion = models.CharField(max_length=50, verbose_name="Acción realizada")
    estado_anterior = models.CharField(
        max_length=15, blank=True, null=True, verbose_name="Estado anterior"
    )
    estado_nuevo = models.CharField(
        max_length=15, blank=True, null=True, verbose_name="Estado nuevo"
    )
    observaciones = models.TextField(
        blank=True, null=True, verbose_name="Observaciones"
    )
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Fecha del cambio"
    )

    class Meta:
        verbose_name = "Historial de Turno"
        verbose_name_plural = "Historiales de Turnos"
        ordering = ["-created_at"]

    def __str__(self):
        fecha_formato = self.created_at.strftime('%d/%m/%Y %H:%M')
        return f"{self.turno} - {self.accion} - {fecha_formato}"
