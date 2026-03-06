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

    turno = models.OneToOneField(
        "turnos.Turno",
        on_delete=models.CASCADE,
        related_name="pago_mercadopago",
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
