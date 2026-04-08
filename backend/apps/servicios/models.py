from django.db import models
from simple_history.models import HistoricalRecords


class Sala(models.Model):
    """
    Salas físicas del estudio
    """

    nombre = models.CharField(max_length=100, verbose_name="Nombre")
    capacidad_simultanea = models.PositiveIntegerField(
        default=1, verbose_name="Capacidad simultánea"
    )
    history = HistoricalRecords()

    class Meta:
        verbose_name = "Sala"
        verbose_name_plural = "Salas"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class CategoriaServicio(models.Model):
    """
    Categorías de servicios (ej: Corte, Coloración, Tratamientos)
    """

    nombre = models.CharField(max_length=100, verbose_name="Nombre")
    descripcion = models.TextField(blank=True, null=True, verbose_name="Descripción")
    sala = models.ForeignKey(
        "servicios.Sala",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="categorias",
        verbose_name="Sala",
    )
    is_active = models.BooleanField(default=True, verbose_name="Activo")
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Fecha de creación"
    )

    class Meta:
        verbose_name = "Categoría de Servicio"
        verbose_name_plural = "Categorías de Servicios"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Servicio(models.Model):
    """
    Servicios ofrecidos por el salón de belleza
    """

    nombre = models.CharField(max_length=200, verbose_name="Nombre")
    descripcion = models.TextField(blank=True, null=True, verbose_name="Descripción")
    categoria = models.ForeignKey(
        CategoriaServicio,
        on_delete=models.CASCADE,
        related_name="servicios",
        verbose_name="Categoría",
    )
    precio = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Precio")
    descuento_reasignacion = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Descuento por reasignación",
        help_text="Descuento fijo a aplicar cuando se ofrece un adelanto de turno",
    )
    permite_reacomodamiento = models.BooleanField(
        default=False,
        verbose_name="Permite reacomodamiento",
        help_text="Indica si el servicio participa en la lógica de rellenar huecos",
    )
    TIPO_DESCUENTO_ADELANTO_CHOICES = [
        ("PORCENTAJE", "Porcentaje"),
        ("MONTO_FIJO", "Monto fijo"),
    ]
    tipo_descuento_adelanto = models.CharField(
        max_length=20,
        choices=TIPO_DESCUENTO_ADELANTO_CHOICES,
        default="PORCENTAJE",
        verbose_name="Tipo de descuento por adelanto",
    )
    valor_descuento_adelanto = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Valor del descuento por adelanto",
    )
    monto_sena_fijo = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Monto fijo de seña",
        help_text="Monto fijo que se cobra como seña. Se normaliza a la mitad del precio del servicio.",
    )
    tiempo_espera_respuesta = models.PositiveIntegerField(
        default=15,
        verbose_name="Tiempo de espera de respuesta (minutos)",
        help_text="Minutos que el sistema espera antes de pasar al siguiente cliente",
    )
    porcentaje_sena = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=25.00,
        verbose_name="Porcentaje de seña",
        help_text="Porcentaje que se cobrará por Mercado Pago",
    )
    horas_minimas_credito_cancelacion = models.PositiveIntegerField(
        default=24,
        verbose_name="Horas mínimas para crédito por cancelación",
        help_text=(
            "Cantidad mínima de horas de anticipación para generar crédito al cancelar. "
            "No puede ser menor a 24 horas."
        ),
    )
    porcentaje_devolucion_sena = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=100,
        verbose_name="Devolución sobre seña (%)",
        help_text="Porcentaje de la seña pagada que se acredita al cancelar en término.",
    )
    porcentaje_devolucion_servicio_completo = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=100,
        verbose_name="Devolución sobre servicio completo (%)",
        help_text=(
            "Porcentaje del valor total del servicio que se acredita cuando el cliente ya pagó el servicio completo."
        ),
    )
    descuento_fidelizacion_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name="Descuento de fidelización (%)",
        help_text=(
            "Porcentaje de descuento específico para este servicio en campañas de fidelización. "
            "Si es 0, se usará el porcentaje global de configuración."
        ),
    )
    descuento_fidelizacion_monto = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Descuento de fidelización ($)",
        help_text=(
            "Monto fijo de descuento para campañas de fidelización. "
            "Si es mayor a 0, tendrá prioridad sobre el porcentaje."
        ),
    )
    bono_reacomodamiento_senia = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=1000,
        verbose_name="Bono reacomodamiento (cliente con seña)",
        help_text="Monto fijo de bono para clientes que pagaron seña.",
    )
    bono_reacomodamiento_pago_completo = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=2000,
        verbose_name="Bono reacomodamiento (cliente con pago completo)",
        help_text="Monto fijo de bono para clientes que pagaron el servicio completo.",
    )
    frecuencia_recurrencia_dias = models.PositiveIntegerField(
        default=30,
        verbose_name="Frecuencia de retorno sugerida (días)",
        help_text="Días sugeridos entre visitas. Usado para identificar clientes inactivos. Si es 0, usa la configuración global.",
    )
    duracion_minutos = models.PositiveIntegerField(verbose_name="Duración (minutos)")
    is_active = models.BooleanField(default=True, verbose_name="Activo")
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Fecha de creación"
    )
    updated_at = models.DateTimeField(
        auto_now=True, verbose_name="Fecha de actualización"
    )
    history = HistoricalRecords()

    class Meta:
        verbose_name = "Servicio"
        verbose_name_plural = "Servicios"
        ordering = ["categoria__nombre", "nombre"]

    def __str__(self):
        return f"{self.categoria.nombre} - {self.nombre}"

    @property
    def duracion_horas(self):
        """Retorna la duración en formato horas:minutos"""
        horas = self.duracion_minutos // 60
        minutos = self.duracion_minutos % 60
        if horas > 0:
            return f"{horas}h {minutos}m" if minutos > 0 else f"{horas}h"
        return f"{minutos}m"
