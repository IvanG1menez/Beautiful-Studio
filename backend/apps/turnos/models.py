"""Modelos para la app de turnos"""

import uuid
from decimal import Decimal
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
from simple_history.models import HistoricalRecords


class Turno(models.Model):
    """Sistema de gestión de turnos/citas"""

    ESTADO_CHOICES = [
        ("pendiente", "Pendiente"),
        ("confirmado", "Confirmado"),
        ("en_proceso", "En Proceso"),
        ("completado", "Completado"),
        ("cancelado", "Cancelado"),
        ("no_asistio", "No Asistió"),
        ("pendiente_manual", "Pendiente manual"),
        ("oferta_enviada", "Oferta enviada"),
        ("expirada", "Expirada"),
    ]

    CANAL_RESERVA_CHOICES = [
        ("web_cliente", "Web cliente"),
        ("fidelizacion", "Oferta de fidelización"),
        ("panel_profesional", "Panel profesional"),
        ("panel_propietario", "Panel propietario"),
    ]

    METODO_PAGO_CHOICES = [
        ("mercadopago", "Mercado Pago"),
        ("mercadopago_qr", "Mercado Pago QR"),
        ("efectivo", "Efectivo"),
        ("transferencia", "Transferencia"),
        ("mixto", "Mixto"),
    ]

    TIPO_PAGO_CHOICES = [
        ("SIN_PAGO", "Sin pago"),
        ("SENIA", "Seña"),
        ("PAGO_COMPLETO", "Pago completo"),
    ]
    """ Relación con otros modelos """
    cliente = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.PROTECT,
        related_name="turnos",
        verbose_name="Cliente",
    )
    empleado = models.ForeignKey(
        "empleados.Empleado",
        on_delete=models.PROTECT,
        related_name="turnos",
        verbose_name="Empleado",
    )
    servicio = models.ForeignKey(
        "servicios.Servicio",
        on_delete=models.PROTECT,
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
        max_length=20,
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
    motivo_cancelacion = models.TextField(
        blank=True,
        null=True,
        verbose_name="Motivo de cancelación",
        help_text="Motivo ingresado por el cliente o el staff al cancelar el turno.",
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
    canal_reserva = models.CharField(
        max_length=30,
        choices=CANAL_RESERVA_CHOICES,
        blank=True,
        null=True,
        verbose_name="Canal de reserva",
        help_text="Origen del turno (web cliente, panel profesional, panel propietario)",
    )
    metodo_pago = models.CharField(
        max_length=30,
        choices=METODO_PAGO_CHOICES,
        blank=True,
        null=True,
        verbose_name="Método de pago principal",
        help_text="Método de pago utilizado para la seña o el pago total",
    )
    tipo_pago = models.CharField(
        max_length=20,
        choices=TIPO_PAGO_CHOICES,
        blank=True,
        null=True,
        verbose_name="Tipo de pago",
        help_text="Indica si el turno fue abonado con seña o pago completo.",
    )
    es_cliente_registrado = models.BooleanField(
        default=True,
        verbose_name="Cliente ya registrado",
        help_text="Indica si el cliente ya existía en la base al crear el turno",
    )
    walkin_nombre = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Nombre cliente walk-in",
    )
    walkin_dni = models.CharField(
        max_length=30,
        blank=True,
        null=True,
        verbose_name="DNI cliente walk-in",
    )
    walkin_email = models.EmailField(
        blank=True,
        null=True,
        verbose_name="Email cliente walk-in",
    )
    walkin_telefono = models.CharField(
        max_length=30,
        blank=True,
        null=True,
        verbose_name="Teléfono cliente walk-in",
    )
    fecha_pago_registrado = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Fecha y hora de registro de pago",
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

        from datetime import timedelta
        from apps.authentication.models import ConfiguracionGlobal

        config_global = ConfiguracionGlobal.get_config()
        brecha_horas = max(1, int(config_global.min_horas_cancelacion_credito or 24))
        limite_cancelacion = self.fecha_hora - timedelta(hours=brecha_horas)
        return timezone.now() < limite_cancelacion

    def resolver_tipo_pago(self):
        """Resuelve el tipo de pago del turno con fallback por inferencia.

        Prioriza el campo persistido `tipo_pago`. Si no está definido,
        infiere según el monto abonado versus el precio del servicio.
        """

        if self.tipo_pago in {"SIN_PAGO", "SENIA", "PAGO_COMPLETO"}:
            return self.tipo_pago

        precio_base = Decimal(self.precio_final or self.servicio.precio or 0)
        monto_abonado = Decimal(self.senia_pagada or 0)

        if monto_abonado <= Decimal("0.00"):
            return "SIN_PAGO"

        if precio_base > Decimal("0.00") and monto_abonado >= precio_base:
            return "PAGO_COMPLETO"

        return "SENIA"

    @staticmethod
    def calcular_pago_final(precio_total, monto_descuento=0, senia_pagada=0):
        """Calcula el pago final restando seña y bono de Proceso 2.

        Se usa como helper genérico para cualquier flujo que necesite
        obtener el monto a cobrar luego de aplicar un descuento fijo
        (bono de reacomodamiento) y la seña ya abonada.
        """

        precio = Decimal(precio_total or 0)
        descuento = Decimal(monto_descuento or 0)
        senia = Decimal(senia_pagada or 0)

        monto = precio - descuento - senia
        return max(Decimal("0.00"), monto)


class HistorialTurno(models.Model):
    """
    Historial de cambios en los turnos
    """

    turno = models.ForeignKey(Turno, on_delete=models.PROTECT, related_name="historial")
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
    origen = models.CharField(
        max_length=40,
        blank=True,
        default="panel",
        verbose_name="Origen del cambio",
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


class MovimientoPagoTurno(models.Model):
    """Movimiento comercial de pago aplicado a un turno.

    Este registro es independiente del proveedor de cobro. Un turno puede tener
    pagos mixtos: seña por Mercado Pago y saldo en efectivo, o viceversa.
    """

    METODO_CHOICES = [
        ("mercadopago", "Mercado Pago"),
        ("mercadopago_qr", "Mercado Pago QR"),
        ("mercadopago_manual", "Mercado Pago manual"),
        ("efectivo", "Efectivo"),
        ("transferencia", "Transferencia"),
        ("billetera", "Billetera"),
        ("mixto", "Mixto"),
        ("manual", "Manual"),
    ]

    TIPO_CHOICES = [
        ("senia", "Seña"),
        ("saldo", "Saldo"),
        ("pago_completo", "Pago completo"),
        ("ajuste", "Ajuste"),
    ]

    ESTADO_CHOICES = [
        ("aprobado", "Aprobado"),
        ("pendiente", "Pendiente"),
        ("cancelado", "Cancelado"),
    ]

    turno = models.ForeignKey(
        Turno,
        on_delete=models.CASCADE,
        related_name="movimientos_pago",
        verbose_name="Turno",
    )
    cliente = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movimientos_pago_turnos",
        verbose_name="Cliente",
    )
    monto = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Monto")
    metodo = models.CharField(max_length=30, choices=METODO_CHOICES)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default="aprobado")
    referencia = models.CharField(max_length=255, blank=True, default="")
    descripcion = models.CharField(max_length=255, blank=True, default="")
    origen = models.CharField(max_length=40, blank=True, default="")
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movimientos_pago_registrados",
    )
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Movimiento de Pago de Turno"
        verbose_name_plural = "Movimientos de Pago de Turnos"
        ordering = ["creado_en", "id"]
        indexes = [
            models.Index(fields=["turno", "estado", "creado_en"]),
            models.Index(fields=["referencia"]),
        ]

    def __str__(self):
        return f"Turno #{self.turno_id} - {self.get_metodo_display()} - ${self.monto}"


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
    tipo_pago_cliente_ofertado = models.CharField(
        max_length=20,
        choices=Turno.TIPO_PAGO_CHOICES,
        blank=True,
        null=True,
        verbose_name="Tipo de pago del cliente ofertado",
    )
    regla_descuento_aplicada = models.CharField(
        max_length=80,
        blank=True,
        null=True,
        verbose_name="Regla de descuento aplicada",
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
    estado_anterior = models.JSONField(null=True, blank=True)
    estado_posterior = models.JSONField(null=True, blank=True)

    class Meta:
        verbose_name = "Log de Reasignación"
        verbose_name_plural = "Logs de Reasignación"
        ordering = ["-fecha_envio"]
        indexes = [
            models.Index(fields=["token"]),
            models.Index(fields=["estado_final", "-fecha_envio"]),
            models.Index(fields=["cliente_notificado", "estado_final", "expires_at"]),
        ]

    def __str__(self):
        return f"Reasignación turno #{self.turno_cancelado_id} - {self.cliente_notificado.nombre_completo}"


class ClienteStreakStats(models.Model):
    """Estado agregado de la racha de consumo por cliente."""

    cliente = models.OneToOneField(
        "clientes.Cliente",
        on_delete=models.CASCADE,
        related_name="streak_stats",
        verbose_name="Cliente",
    )
    streak_count = models.PositiveIntegerField(default=0, verbose_name="Racha actual")
    last_completed_turno = models.ForeignKey(
        Turno,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="Último turno completado",
    )
    last_completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha último completado",
    )
    next_expiration_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Próximo vencimiento de racha",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Estadística de Racha"
        verbose_name_plural = "Estadísticas de Racha"

    def __str__(self):
        return f"Racha {self.cliente.nombre_completo}: {self.streak_count}"


class StreakRewardEvent(models.Model):
    """Evento de evaluación/aplicación de bono por múltiplos de racha."""

    STATUS_CHOICES = [
        ("aplicado", "Aplicado"),
        ("saltado_prioridad", "Saltado por prioridad"),
        ("revertido", "Revertido"),
    ]

    cliente = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.CASCADE,
        related_name="streak_reward_events",
    )
    turno = models.ForeignKey(
        Turno,
        on_delete=models.PROTECT,
        related_name="streak_reward_events",
    )
    milestone_number = models.PositiveIntegerField(verbose_name="Hito alcanzado")
    streak_before = models.PositiveIntegerField(default=0)
    streak_after = models.PositiveIntegerField(default=0)
    bonus_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    applied_discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Descuento aplicado",
    )
    status = models.CharField(max_length=24, choices=STATUS_CHOICES)
    reason = models.CharField(max_length=100, blank=True, default="")
    valor_anterior = models.JSONField(null=True, blank=True)
    valor_posterior = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Evento de Bono por Racha"
        verbose_name_plural = "Eventos de Bono por Racha"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["turno", "milestone_number"],
                name="unique_streak_reward_per_turno_milestone",
            )
        ]

    def __str__(self):
        return f"PA3 cliente={self.cliente_id} turno={self.turno_id} hito={self.milestone_number}"


class StreakCoupon(models.Model):
    """Cupón de fidelidad generado por hitos de racha."""

    STATUS_CHOICES = [
        ("pendiente", "Pendiente"),
        ("reclamado", "Reclamado"),
        ("usado", "Usado"),
        ("vencido", "Vencido"),
        ("cancelado", "Cancelado"),
    ]

    cliente = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.CASCADE,
        related_name="streak_coupons",
    )
    reward_event = models.OneToOneField(
        StreakRewardEvent,
        on_delete=models.CASCADE,
        related_name="coupon",
        null=True,
        blank=True,
    )
    code = models.CharField(max_length=20, unique=True, null=True, blank=True)
    milestone_number = models.PositiveIntegerField(verbose_name="Hito alcanzado")
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pendiente")
    claimed_at = models.DateTimeField(null=True, blank=True)
    used_at = models.DateTimeField(null=True, blank=True)
    used_turno = models.ForeignKey(
        Turno,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="streak_coupons_used",
    )
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Cupón de racha"
        verbose_name_plural = "Cupones de racha"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["cliente", "status"]),
            models.Index(fields=["code"]),
        ]

    def __str__(self):
        return f"Cupón racha cliente={self.cliente_id} hito={self.milestone_number} estado={self.status}"


class StreakExpiryAlertLog(models.Model):
    """Deduplicación de alertas de vencimiento de racha."""

    cliente = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.CASCADE,
        related_name="streak_expiry_alerts",
    )
    threshold_days = models.PositiveSmallIntegerField(verbose_name="Umbral de días")
    expiration_date_reference = models.DateField(verbose_name="Fecha de vencimiento")
    channels_sent = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Log alerta vencimiento racha"
        verbose_name_plural = "Logs alerta vencimiento racha"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["cliente", "threshold_days", "expiration_date_reference"],
                name="unique_streak_expiry_alert",
            )
        ]


class StreakAuditLog(models.Model):
    """Auditoría explícita de cambios de contador y bonos de PA3."""

    ACCION_CHOICES = [
        ("insercion", "Inserción"),
        ("modificacion", "Modificación"),
    ]
    EVENT_TYPE_CHOICES = [
        ("streak_counter", "Contador de racha"),
        ("streak_bonus", "Bono de racha"),
    ]

    cliente = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.CASCADE,
        related_name="streak_audit_logs",
    )
    turno = models.ForeignKey(
        Turno,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="streak_audit_logs",
    )
    accion = models.CharField(max_length=20, choices=ACCION_CHOICES)
    event_type = models.CharField(max_length=30, choices=EVENT_TYPE_CHOICES)
    valor_anterior = models.JSONField(null=True, blank=True)
    valor_posterior = models.JSONField(null=True, blank=True)
    detalle = models.CharField(max_length=180, blank=True, default="")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="streak_audit_events",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Auditoría PA3"
        verbose_name_plural = "Auditoría PA3"
        ordering = ["-created_at"]

