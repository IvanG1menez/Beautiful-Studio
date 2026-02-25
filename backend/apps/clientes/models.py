"""Modelos para la app de clientes"""

from django.db import models
from django.conf import settings
from simple_history.models import HistoricalRecords


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
    history = HistoricalRecords()

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


class Billetera(models.Model):
    """
    Sistema de billetera virtual para clientes con créditos por cancelaciones
    """

    cliente = models.OneToOneField(
        Cliente,
        on_delete=models.CASCADE,
        related_name="billetera",
        verbose_name="Cliente",
    )
    saldo = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, verbose_name="Saldo disponible"
    )
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Fecha de creación"
    )
    updated_at = models.DateTimeField(
        auto_now=True, verbose_name="Última actualización"
    )

    class Meta:
        verbose_name = "Billetera"
        verbose_name_plural = "Billeteras"

    def __str__(self):
        return f"Billetera de {self.cliente.nombre_completo} - ${self.saldo}"

    def agregar_saldo(self, monto, motivo=""):
        """Agrega crédito a la billetera"""
        from decimal import Decimal

        self.saldo += Decimal(str(monto))
        self.save()

        # Registrar movimiento
        MovimientoBilletera.objects.create(
            billetera=self,
            tipo="credito",
            monto=monto,
            saldo_anterior=self.saldo - Decimal(str(monto)),
            saldo_nuevo=self.saldo,
            descripcion=motivo,
        )

    def descontar_saldo(self, monto, motivo=""):
        """Descuenta saldo de la billetera"""
        from decimal import Decimal
        from django.core.exceptions import ValidationError

        monto_decimal = Decimal(str(monto))
        if self.saldo < monto_decimal:
            raise ValidationError("Saldo insuficiente")

        saldo_anterior = self.saldo
        self.saldo -= monto_decimal
        self.save()

        # Registrar movimiento
        MovimientoBilletera.objects.create(
            billetera=self,
            tipo="debito",
            monto=monto,
            saldo_anterior=saldo_anterior,
            saldo_nuevo=self.saldo,
            descripcion=motivo,
        )


class MovimientoBilletera(models.Model):
    """
    Historial de movimientos de la billetera
    """

    TIPO_CHOICES = [
        ("credito", "Crédito"),
        ("debito", "Débito"),
    ]

    billetera = models.ForeignKey(
        Billetera,
        on_delete=models.CASCADE,
        related_name="movimientos",
        verbose_name="Billetera",
    )
    tipo = models.CharField(
        max_length=20, choices=TIPO_CHOICES, verbose_name="Tipo de movimiento"
    )
    monto = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Monto")
    saldo_anterior = models.DecimalField(
        max_digits=10, decimal_places=2, verbose_name="Saldo anterior"
    )
    saldo_nuevo = models.DecimalField(
        max_digits=10, decimal_places=2, verbose_name="Saldo nuevo"
    )
    descripcion = models.TextField(blank=True, null=True, verbose_name="Descripción")
    turno = models.ForeignKey(
        "turnos.Turno",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movimientos_billetera",
        verbose_name="Turno relacionado",
    )
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Fecha del movimiento"
    )

    class Meta:
        verbose_name = "Movimiento de Billetera"
        verbose_name_plural = "Movimientos de Billetera"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_tipo_display()} - ${self.monto} - {self.created_at.strftime('%d/%m/%Y %H:%M')}"
