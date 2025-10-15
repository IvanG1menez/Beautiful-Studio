"""Modelos para la app de clientes"""

from django.db import models
from django.conf import settings


class Cliente(models.Model):
    """
    Información adicional de clientes
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="cliente_profile",
        verbose_name="Usuario",
    )
    fecha_nacimiento = models.DateField(
        blank=True, null=True, verbose_name="Fecha de nacimiento"
    )
    direccion = models.TextField(blank=True, null=True, verbose_name="Dirección")

    preferencias = models.TextField(
        blank=True, null=True, verbose_name="Preferencias y notas"
    )
    fecha_primera_visita = models.DateTimeField(
        blank=True, null=True, verbose_name="Primera visita"
    )
    is_vip = models.BooleanField(default=False, verbose_name="Cliente VIP")
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Fecha de creación"
    )
    updated_at = models.DateTimeField(
        auto_now=True, verbose_name="Fecha de actualización"
    )

    class Meta:
        """Meta datos del modelo"""

        verbose_name = "Cliente"
        verbose_name_plural = "Clientes"
        ordering = ["-created_at"]

    def __str__(self):
        """Representación string del cliente"""
        if self.user:
            nombre = getattr(self.user, "full_name", None) or getattr(
                self.user, "username", "Sin usuario"
            )
            return f"Cliente: {nombre}"
        return f"Cliente #{self.pk}"

    @property
    def nombre_completo(self):
        """Propiedad para obtener el nombre completo del cliente"""
        if self.user:
            return getattr(self.user, "full_name", None) or getattr(
                self.user, "username", "Sin usuario"
            )
        return "Sin usuario asignado"

    @property
    def email(self):
        """Email del cliente"""
        return self.user.email if self.user else None

    @property
    def telefono(self):
        """Teléfono del cliente"""
        return self.user.phone if self.user else None

    @property
    def edad(self):
        """Calcula la edad del cliente basada en su fecha de nacimiento"""
        if self.fecha_nacimiento:
            from datetime import date

            today = date.today()
            # Verificar si ya pasó el cumpleaños este año
            birthday_passed = (today.month, today.day) >= (
                self.fecha_nacimiento.month,
                self.fecha_nacimiento.day,
            )
            age = today.year - self.fecha_nacimiento.year
            return age - (not birthday_passed)
        return None

    @property
    def tiempo_como_cliente(self):
        """Calcula cuánto tiempo ha sido cliente"""
        if self.fecha_primera_visita:
            from django.utils import timezone

            delta = timezone.now() - self.fecha_primera_visita
            return delta.days
        return None

    def clean(self):
        """Validaciones personalizadas del modelo"""
        from django.core.exceptions import ValidationError
        from datetime import date

        if self.fecha_nacimiento:
            if self.fecha_nacimiento > date.today():
                raise ValidationError(
                    {
                        "fecha_nacimiento": (
                            ("La fecha de nacimiento no puede estar en el " "futuro.")
                        )
                    }
                )

            # Validar edad mínima (ejemplo: 13 años)
            if self.edad and self.edad < 13:
                raise ValidationError(
                    {"fecha_nacimiento": ("El cliente debe tener al menos 13 años.")}
                )

    def save(self, *args, **kwargs):
        """Override save para establecer fecha_primera_visita"""
        if not self.fecha_primera_visita and not self.pk:
            from django.utils import timezone

            self.fecha_primera_visita = timezone.now()

        # Ejecutar validaciones antes de guardar
        self.full_clean()
        super().save(*args, **kwargs)
