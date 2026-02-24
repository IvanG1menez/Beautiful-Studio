"""Modelos para la app de turnos"""

import uuid
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
from simple_history.models import HistoricalRecords


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
        ("oferta_enviada", "Oferta enviada"),
        ("expirada", "Expirada"),
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
    sala = models.ForeignKey(
        "servicios.Sala",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="turnos",
        verbose_name="Sala",
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
    senia_pagada = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Seña pagada",
        help_text="Monto de seña ya abonada por el cliente",
    )
    fecha_hora_completado = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Fecha y hora de finalización",
        help_text="Registra cuándo se marcó el turno como completado",
    )
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Fecha de creación"
    )
    updated_at = models.DateTimeField(
        auto_now=True, verbose_name="Fecha de actualización"
    )
    history = HistoricalRecords()

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
                self.cliente.nombre_completo if self.cliente else "Cliente desconocido"
            )
            servicio_nombre = (
                self.servicio.nombre if self.servicio else "Servicio desconocido"
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
        # TODO: Reactivar validación de fecha en el futuro
        # Por ahora está desactivada para permitir finalizar turnos en cualquier momento
        # if self.fecha_hora and self.fecha_hora < timezone.now():
        #     raise ValidationError(
        #         "No se puede programar un turno en el pasado."
        #     )
        pass

    def validar_capacidad_salas(self, fecha_hora=None, servicio=None):
        """Valida la disponibilidad de capacidad física por sala."""
        from datetime import timedelta

        servicio_actual = servicio or self.servicio
        fecha_hora_actual = fecha_hora or self.fecha_hora

        if not servicio_actual or not fecha_hora_actual:
            return

        sala_actual = (
            servicio_actual.categoria.sala if servicio_actual.categoria else None
        )

        if not sala_actual:
            raise ValidationError("La categoría no tiene sala asignada.")

        if sala_actual.capacidad_simultanea <= 0:
            raise ValidationError("Capacidad física de la sala agotada.")

        hora_fin = fecha_hora_actual + timedelta(
            minutes=servicio_actual.duracion_minutos
        )

        turnos_existentes = Turno.objects.select_related("servicio", "sala").filter(
            sala=sala_actual,
            estado__in=["pendiente", "confirmado", "en_proceso"],
        )

        if self.pk:
            turnos_existentes = turnos_existentes.exclude(pk=self.pk)

        ocupados = 0
        for turno in turnos_existentes:
            if not turno.fecha_hora or not turno.servicio:
                continue
            turno_fin = turno.fecha_hora + timedelta(
                minutes=turno.servicio.duracion_minutos
            )
            if fecha_hora_actual < turno_fin and hora_fin > turno.fecha_hora:
                ocupados += 1

        if ocupados >= sala_actual.capacidad_simultanea:
            raise ValidationError("Capacidad física de la sala agotada.")

    def save(self, *args, **kwargs):
        if self.servicio and self.servicio.categoria:
            self.sala = self.servicio.categoria.sala
        super().save(*args, **kwargs)

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
        if self.estado in [
            "completado",
            "cancelado",
            "no_asistio",
            "oferta_enviada",
            "expirada",
        ]:
            return False
        # No se puede cancelar si falta menos de 2 horas
        from datetime import timedelta

        limite_cancelacion = self.fecha_hora - timedelta(hours=2)
        return timezone.now() < limite_cancelacion


class HistorialTurno(models.Model):
    """
    Historial de cambios en los turnos
    """

    turno = models.ForeignKey(Turno, on_delete=models.CASCADE, related_name="historial")
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
        fecha_formato = self.created_at.strftime("%d/%m/%Y %H:%M")
        return f"{self.turno} - {self.accion} - {fecha_formato}"


class LogReasignacion(models.Model):
    """
    Registro de ofertas de reasignación de turnos tras cancelaciones
    """

    ESTADO_FINAL_CHOICES = [
        ("aceptada", "Aceptada"),
        ("rechazada", "Rechazada"),
        ("expirada", "Expirada"),
    ]

    turno_cancelado = models.ForeignKey(
        Turno,
        on_delete=models.CASCADE,
        related_name="reasignaciones_cancelado",
        verbose_name="Turno cancelado",
    )
    turno_ofrecido = models.ForeignKey(
        Turno,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reasignaciones_ofrecido",
        verbose_name="Turno ofrecido",
    )
    cliente_notificado = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.CASCADE,
        related_name="reasignaciones_notificadas",
        verbose_name="Cliente notificado",
    )
    monto_descuento = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Monto de descuento",
    )
    token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        verbose_name="Token",
    )
    fecha_envio = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de envío",
    )
    expires_at = models.DateTimeField(verbose_name="Expira")
    estado_final = models.CharField(
        max_length=20,
        choices=ESTADO_FINAL_CHOICES,
        null=True,
        blank=True,
        verbose_name="Estado final",
    )

    class Meta:
        verbose_name = "Log de Reasignación"
        verbose_name_plural = "Logs de Reasignación"
        ordering = ["-fecha_envio"]
        indexes = [
            models.Index(fields=["token"]),
            models.Index(fields=["estado_final", "-fecha_envio"]),
        ]

    def __str__(self):
        return f"Reasignación turno #{self.turno_cancelado_id} - {self.cliente_notificado.nombre_completo}"
