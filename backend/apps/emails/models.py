from django.db import models
from django.conf import settings
import uuid
from datetime import timedelta

from django.utils import timezone


class NotificacionConfig(models.Model):
    """
    Configuración de notificaciones por usuario
    Define qué tipo de notificaciones quiere recibir cada usuario
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notificacion_config",
    )

    # Notificaciones en la plataforma para profesionales
    notificar_solicitud_turno = models.BooleanField(
        default=True, help_text="Notificar cuando un cliente solicita un turno"
    )
    notificar_pago_turno = models.BooleanField(
        default=True, help_text="Notificar cuando un cliente paga un turno"
    )
    notificar_cancelacion_turno = models.BooleanField(
        default=True, help_text="Notificar cuando un cliente cancela un turno"
    )
    notificar_modificacion_turno = models.BooleanField(
        default=True, help_text="Notificar cuando se modifica un turno"
    )

    # Notificaciones adicionales para propietarios
    notificar_nuevo_empleado = models.BooleanField(
        default=True,
        help_text="Notificar cuando se registra un nuevo empleado (solo propietario)",
    )
    notificar_nuevo_cliente = models.BooleanField(
        default=True,
        help_text="Notificar cuando se registra un nuevo cliente (solo propietario)",
    )
    notificar_reporte_diario = models.BooleanField(
        default=True, help_text="Notificar resumen diario de turnos (solo propietario)"
    )

    # Control de envío de emails
    email_solicitud_turno = models.BooleanField(
        default=True, help_text="Enviar email cuando se asigna un turno"
    )
    email_pago_turno = models.BooleanField(
        default=True, help_text="Enviar email cuando hay pago pendiente"
    )
    email_cancelacion_turno = models.BooleanField(
        default=True, help_text="Enviar email cuando se cancela un turno"
    )
    email_modificacion_turno = models.BooleanField(
        default=True, help_text="Enviar email cuando se modifica un turno"
    )
    email_recordatorio_turno = models.BooleanField(
        default=True, help_text="Enviar email recordatorio antes del turno"
    )
    email_reporte_diario = models.BooleanField(
        default=True, help_text="Enviar email con reporte diario (solo propietario)"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notificaciones_notificacionconfig"
        verbose_name = "Configuración de Notificación"
        verbose_name_plural = "Configuraciones de Notificaciones"

    def __str__(self):
        return f"Config notificaciones - {self.user.email}"


class Notificacion(models.Model):
    """
    Notificaciones enviadas a los usuarios
    """

    TIPO_CHOICES = [
        ("solicitud_turno", "Solicitud de Turno"),
        ("pago_turno", "Pago de Turno"),
        ("cancelacion_turno", "Cancelación de Turno"),
        ("modificacion_turno", "Modificación de Turno"),
        ("nuevo_empleado", "Nuevo Empleado"),
        ("nuevo_cliente", "Nuevo Cliente"),
        ("reporte_diario", "Reporte Diario"),
        ("recordatorio", "Recordatorio"),
        ("fidelizacion", "Fidelización de Clientes"),
    ]

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notificaciones",
    )
    tipo = models.CharField(max_length=50, choices=TIPO_CHOICES)
    titulo = models.CharField(max_length=200)
    mensaje = models.TextField()
    leida = models.BooleanField(default=False)

    # Datos adicionales en JSON para referencias
    data = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    leida_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "notificaciones_notificacion"
        verbose_name = "Notificación"
        verbose_name_plural = "Notificaciones"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["usuario", "-created_at"]),
            models.Index(fields=["usuario", "leida"]),
        ]

    def __str__(self):
        return f"{self.tipo} - {self.usuario.email} - {'Leída' if self.leida else 'No leída'}"

    def marcar_leida(self):
        """Marca la notificación como leída"""
        if not self.leida:
            self.leida = True
            from django.utils import timezone

            self.leida_at = timezone.now()
            self.save(update_fields=["leida", "leida_at"])


class PasswordResetToken(models.Model):
    """
    Modelo para gestionar tokens de recuperación de contraseña
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_reset_tokens",
    )
    token = models.CharField(max_length=150, unique=True, verbose_name="Token")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Creado")
    expires_at = models.DateTimeField(verbose_name="Expira")
    used = models.BooleanField(default=False, verbose_name="Usado")
    used_at = models.DateTimeField(null=True, blank=True, verbose_name="Usado el")

    class Meta:
        db_table = "notificaciones_passwordresettoken"
        verbose_name = "Token de Recuperación de Contraseña"
        verbose_name_plural = "Tokens de Recuperación de Contraseña"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["token"]),
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        return f"Token para {self.user.email} - {'Usado' if self.used else 'Activo'}"

    def is_valid(self):
        """Verifica si el token es válido (no usado y no expirado)"""
        from django.utils import timezone

        return not self.used and self.expires_at > timezone.now()

    def mark_used(self):
        """Marca el token como usado"""
        from django.utils import timezone

        self.used = True
        self.used_at = timezone.now()
        self.save(update_fields=["used", "used_at"])


class AccessToken(models.Model):
    """Token de acceso mágico para autologin desde emails.

    Se usa para flujos como fidelización de clientes, permitiendo que el
    usuario acceda sin ingresar credenciales. Es de un solo uso y expira
    automáticamente luego de un tiempo configurable.
    """

    class TipoAccion(models.TextChoices):
        CON_SALDO = "CON_SALDO", "Con saldo en billetera"
        CON_DESCUENTO = "CON_DESCUENTO", "Con descuento"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="access_tokens",
    )
    token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        db_index=True,
    )
    tipo_accion = models.CharField(
        max_length=20,
        choices=TipoAccion.choices,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    # Tiempo de expiración del enlace en horas (por defecto, 48hs)
    EXPIRATION_HOURS = 48

    @property
    def is_expired(self) -> bool:
        """Indica si el token ya expiró o fue usado."""

        if self.used_at is not None:
            return True

        expiry_time = self.created_at + timedelta(hours=self.EXPIRATION_HOURS)
        return timezone.now() > expiry_time

    def mark_used(self) -> None:
        """Marca el token como usado (one-shot)."""

        if self.used_at is None:
            self.used_at = timezone.now()
            self.save(update_fields=["used_at"])

    class Meta:
        db_table = "emails_accesstoken"
        verbose_name = "Token de Acceso"
        verbose_name_plural = "Tokens de Acceso"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["token"]),
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"AccessToken({self.user.email}, {self.token})"
