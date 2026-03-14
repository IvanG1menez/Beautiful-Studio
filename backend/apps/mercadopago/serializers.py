"""Serializers para la app de Mercado Pago"""

from rest_framework import serializers
from .models import PagoMercadoPago


class CrearPreferenciaSerializer(serializers.Serializer):
    """Valida los datos de entrada para crear una preferencia de pago."""

    turno_id = serializers.IntegerField(min_value=1)


class CrearPreferenciaSinTurnoSerializer(serializers.Serializer):
    """
    Valida los datos para crear una preferencia de MP *sin* crear el turno.
    El turno se crea en el webhook una vez que el pago es aprobado (o de forma
    inmediata cuando los créditos cubren el 100% del monto).
    """

    servicio_id = serializers.IntegerField(min_value=1)
    empleado_id = serializers.IntegerField(min_value=1)
    fecha_hora = serializers.DateTimeField()
    notas_cliente = serializers.CharField(required=False, allow_blank=True, default="")
    # Si True, se cobra solo la seña (porcentaje_sena % del precio total).
    # Si False, se cobra el precio completo.
    usar_sena = serializers.BooleanField(required=False, default=True)
    # Créditos de billetera a descontar del monto (nunca negativos).
    creditos_a_aplicar = serializers.DecimalField(
        required=False, default=0, max_digits=10, decimal_places=2, min_value=0
    )
    # Flag opcional para aplicar descuento de fidelización (flujo de emails de retorno)
    aplicar_descuento_fidelizacion = serializers.BooleanField(
        required=False, default=False
    )


class PagoMercadoPagoSerializer(serializers.ModelSerializer):
    """Serializer completo para listar/detallar pagos."""

    turno_id = serializers.IntegerField(source="turno.id", read_only=True)
    cliente_email = serializers.EmailField(
        source="cliente.user.email", read_only=True, default=""
    )
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)

    class Meta:
        model = PagoMercadoPago
        fields = [
            "id",
            "turno_id",
            "cliente_email",
            "preference_id",
            "payment_id",
            "init_point",
            "monto",
            "descripcion",
            "estado",
            "estado_display",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = fields
