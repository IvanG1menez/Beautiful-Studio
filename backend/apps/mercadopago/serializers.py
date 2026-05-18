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
    # Compatibilidad legacy: si True, cobra seña; si False, total.
    usar_sena = serializers.BooleanField(required=False, default=True)
    # Nuevo modo recomendado: tipo de pago explícito.
    tipo_pago = serializers.ChoiceField(
        choices=["SENIA", "PAGO_COMPLETO"], required=False
    )
    # Créditos de billetera a descontar del monto (nunca negativos).
    creditos_a_aplicar = serializers.DecimalField(
        required=False, default=0, max_digits=10, decimal_places=2, min_value=0
    )
    # Flag opcional para aplicar descuento de fidelización (flujo de emails de retorno)
    aplicar_descuento_fidelizacion = serializers.BooleanField(
        required=False, default=False
    )
    coupon_code = serializers.CharField(required=False, allow_blank=True, default="")


class CrearPreferenciaReprogramacionSerializer(serializers.Serializer):
    """Valida el pago de una reprogramación fuera de rango para un turno existente."""

    turno_id = serializers.IntegerField(min_value=1)
    nueva_fecha_hora = serializers.DateTimeField()
    motivo = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    nuevo_empleado_id = serializers.IntegerField(required=False, allow_null=True)
    tipo_pago = serializers.ChoiceField(choices=["SENIA", "PAGO_COMPLETO"])


class CrearPreferenciaStaffSerializer(serializers.Serializer):
    """Datos para crear una preferencia de MP iniciada desde el panel.

    A diferencia de ``CrearPreferenciaSinTurnoSerializer``, el cliente puede
    ser un walk-in o uno ya existente, y el usuario autenticado suele ser un
    profesional o propietario.
    """

    servicio_id = serializers.IntegerField(min_value=1)
    empleado_id = serializers.IntegerField(min_value=1)
    fecha_hora = serializers.DateTimeField()
    notas_cliente = serializers.CharField(required=False, allow_blank=True, default="")

    # Datos del cliente (uno de: cliente_id, dni o email)
    cliente_id = serializers.IntegerField(required=False)
    dni = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    nombre = serializers.CharField(required=False, allow_blank=True)
    telefono = serializers.CharField(required=False, allow_blank=True)

    # Compatibilidad legacy: si True, cobra seña; si False, total.
    usar_sena = serializers.BooleanField(required=False, default=True)
    # Nuevo modo recomendado: tipo de pago explícito.
    tipo_pago = serializers.ChoiceField(
        choices=["SENIA", "PAGO_COMPLETO"], required=False
    )

    def validate_email(self, value):
        return (value or "").strip().lower()

    def validate(self, attrs):
        # Requiere al menos algún identificador mínimo del cliente
        if not (
            attrs.get("cliente_id")
            or (attrs.get("dni") or "").strip()
            or (attrs.get("email") or "").strip()
        ):
            raise serializers.ValidationError(
                "Debe proporcionar cliente_id o al menos DNI o email para identificar al cliente."
            )
        return attrs


class ConfirmarPagoStaffSerializer(serializers.Serializer):
    """Valida la confirmación manual de un pago presencial por ID de operación."""

    preference_id = serializers.CharField()
    payment_id = serializers.CharField()

    def validate_payment_id(self, value):
        payment_id = (value or "").strip()
        if not payment_id.isdigit():
            raise serializers.ValidationError("El ID de operación debe ser numérico.")
        return payment_id

    def validate_preference_id(self, value):
        preference_id = (value or "").strip()
        if not preference_id:
            raise serializers.ValidationError("La preferencia es requerida.")
        return preference_id


class CancelarPagoStaffSerializer(serializers.Serializer):
    """Valida la cancelación de una preferencia presencial pendiente."""

    preference_id = serializers.CharField()

    def validate_preference_id(self, value):
        preference_id = (value or "").strip()
        if not preference_id:
            raise serializers.ValidationError("La preferencia es requerida.")
        return preference_id


class CrearCobroTurnoStaffSerializer(serializers.Serializer):
    """Valida la creación de un QR para cobrar saldo de un turno existente."""

    turno_id = serializers.IntegerField(min_value=1)


class ConfirmarPagoManualSerializer(serializers.Serializer):
    """Valida el cierre manual de un pago cuando Mercado Pago no confirma a tiempo."""

    preference_id = serializers.CharField()
    payment_id = serializers.CharField()
    motivo = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_preference_id(self, value):
        preference_id = (value or "").strip()
        if not preference_id:
            raise serializers.ValidationError("La preferencia u orden es requerida.")
        return preference_id

    def validate_payment_id(self, value):
        payment_id = (value or "").strip()
        if not payment_id:
            raise serializers.ValidationError("El número de operación es obligatorio.")
        return payment_id


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

