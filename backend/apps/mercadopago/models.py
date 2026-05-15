"""Modelos para la app de Mercado Pago"""

from django.db import models


class PagoMercadoPago(models.Model):
    """
    Registro de cada intento/pago procesado por Mercado Pago.

    external_reference → ID del Turno (usado para correlacionar el webhook con el turno).
    preference_id      → ID de la preferencia creada en la API de MP.
    init_point         → URL de checkout productivo.
    """

    ESTADO_CHOICES = [
        ("pending", "Pendiente"),
        ("approved", "Aprobado"),
        ("authorized", "Autorizado"),
        ("in_process", "En proceso"),
        ("in_mediation", "En mediación"),
        ("rejected", "Rechazado"),
        ("cancelled", "Cancelado"),
        ("refunded", "Reembolsado"),
        ("charged_back", "Contracargo"),
    ]

    turno = models.ForeignKey(
        "turnos.Turno",
        on_delete=models.CASCADE,
        related_name="pagos_mercadopago",
        verbose_name="Turno",
    )
    cliente = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pagos_mercadopago",
        verbose_name="Cliente",
    )
    preference_id = models.CharField(
        max_length=255,
        verbose_name="ID de Preferencia MP",
    )
    payment_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="ID de Pago MP",
    )
    init_point = models.URLField(
        max_length=512,
        blank=True,
        verbose_name="URL de Checkout",
    )
    monto = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Monto",
    )
    moneda = models.CharField(
        max_length=10,
        default="ARS",
        verbose_name="Moneda",
    )
    descripcion = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Descripción",
    )
    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default="pending",
        verbose_name="Estado",
    )
    creado_en = models.DateTimeField(auto_now_add=True, verbose_name="Creado en")
    actualizado_en = models.DateTimeField(auto_now=True, verbose_name="Actualizado en")

    class Meta:
        verbose_name = "Pago Mercado Pago"
        verbose_name_plural = "Pagos Mercado Pago"
        ordering = ["-creado_en"]

    def __str__(self):
        return f"Pago {self.preference_id} — {self.estado} — ${self.monto}"


class PreferenciaMercadoPagoCancelada(models.Model):
    """Preferencias presenciales canceladas desde el panel antes de confirmar pago."""

    preference_id = models.CharField(max_length=255, unique=True)
    motivo = models.CharField(max_length=255, blank=True)
    cancelado_por = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="preferencias_mp_canceladas",
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Preferencia Mercado Pago cancelada"
        verbose_name_plural = "Preferencias Mercado Pago canceladas"

    def __str__(self):
        return f"Preferencia cancelada {self.preference_id}"


class OrdenMercadoPagoPresencial(models.Model):
    """Orden QR presencial pendiente de confirmación por Mercado Pago."""

    ESTADO_CHOICES = [
        ("pending", "Pendiente"),
        ("approved", "Aprobada"),
        ("cancelled", "Cancelada"),
    ]

    reference_id = models.CharField(max_length=255, unique=True)
    payload = models.JSONField()
    qr_data = models.TextField(blank=True)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default="pending")
    payment_id = models.CharField(max_length=255, blank=True, null=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Orden Mercado Pago presencial"
        verbose_name_plural = "Órdenes Mercado Pago presenciales"
        ordering = ["-creado_en"]

    def __str__(self):
        return f"Orden presencial {self.reference_id} — {self.estado}"
