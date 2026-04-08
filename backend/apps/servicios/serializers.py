from decimal import Decimal, ROUND_HALF_UP

from rest_framework import serializers
from .models import CategoriaServicio, Servicio, Sala


class CategoriaServicioSerializer(serializers.ModelSerializer):
    """
    Serializador para CategoriaServicio
    """

    sala_nombre = serializers.CharField(source="sala.nombre", read_only=True)
    sala_capacidad = serializers.IntegerField(
        source="sala.capacidad_simultanea", read_only=True
    )

    class Meta:
        model = CategoriaServicio
        fields = "__all__"


class ServicioSerializer(serializers.ModelSerializer):
    """
    Serializador para Servicio
    """

    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)
    sala_nombre = serializers.CharField(
        source="categoria.sala.nombre", read_only=True, allow_null=True
    )
    duracion_horas = serializers.ReadOnlyField()

    class Meta:
        model = Servicio
        fields = (
            "id",
            "nombre",
            "descripcion",
            "categoria",
            "categoria_nombre",
            "sala_nombre",
            "precio",
            "descuento_reasignacion",
            "permite_reacomodamiento",
            "tipo_descuento_adelanto",
            "valor_descuento_adelanto",
            "monto_sena_fijo",
            "tiempo_espera_respuesta",
            "porcentaje_sena",
            "horas_minimas_credito_cancelacion",
            "porcentaje_devolucion_sena",
            "porcentaje_devolucion_servicio_completo",
            "bono_reacomodamiento_senia",
            "bono_reacomodamiento_pago_completo",
            "descuento_fidelizacion_pct",
            "descuento_fidelizacion_monto",
            "frecuencia_recurrencia_dias",
            "duracion_minutos",
            "duracion_horas",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def validate(self, attrs):
        attrs = super().validate(attrs)

        horas_minimas = attrs.get(
            "horas_minimas_credito_cancelacion",
            getattr(self.instance, "horas_minimas_credito_cancelacion", 24),
        )
        if horas_minimas < 24:
            raise serializers.ValidationError(
                {
                    "horas_minimas_credito_cancelacion": (
                        "La devolución de crédito no puede configurarse con menos de 24 horas."
                    )
                }
            )

        for field_name in [
            "porcentaje_devolucion_sena",
            "porcentaje_devolucion_servicio_completo",
        ]:
            value = attrs.get(field_name, getattr(self.instance, field_name, 100))
            if value < 0 or value > 100:
                raise serializers.ValidationError(
                    {field_name: "Debe ser un porcentaje entre 0 y 100."}
                )

        for field_name in [
            "monto_sena_fijo",
            "bono_reacomodamiento_senia",
            "bono_reacomodamiento_pago_completo",
            "valor_descuento_adelanto",
        ]:
            value = attrs.get(field_name, getattr(self.instance, field_name, 0))
            if value < 0:
                raise serializers.ValidationError(
                    {field_name: "Debe ser un valor mayor o igual a 0."}
                )

        # Regla de negocio: la seña fija siempre representa el 50% del servicio.
        precio = attrs.get("precio", getattr(self.instance, "precio", 0))
        precio_decimal = Decimal(str(precio or 0))
        monto_sena_fijo = (precio_decimal / Decimal("2")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        attrs["monto_sena_fijo"] = monto_sena_fijo

        # Se mantiene porcentaje_sena para compatibilidad con flujos existentes.
        attrs["porcentaje_sena"] = (
            Decimal("50.00") if precio_decimal > 0 else Decimal("0.00")
        )

        return attrs


class ServicioListSerializer(serializers.ModelSerializer):
    """
    Serializador simplificado para listado de servicios
    """

    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)
    sala_nombre = serializers.CharField(
        source="categoria.sala.nombre", read_only=True, allow_null=True
    )
    duracion_horas = serializers.ReadOnlyField()

    class Meta:
        model = Servicio
        fields = (
            "id",
            "nombre",
            "descripcion",
            "categoria",
            "categoria_nombre",
            "sala_nombre",
            "precio",
            "descuento_reasignacion",
            "permite_reacomodamiento",
            "tipo_descuento_adelanto",
            "valor_descuento_adelanto",
            "monto_sena_fijo",
            "tiempo_espera_respuesta",
            "porcentaje_sena",
            "horas_minimas_credito_cancelacion",
            "porcentaje_devolucion_sena",
            "porcentaje_devolucion_servicio_completo",
            "bono_reacomodamiento_senia",
            "bono_reacomodamiento_pago_completo",
            "descuento_fidelizacion_pct",
            "descuento_fidelizacion_monto",
            "frecuencia_recurrencia_dias",
            "duracion_minutos",
            "duracion_horas",
            "is_active",
        )


class SalaSerializer(serializers.ModelSerializer):
    """
    Serializador para Sala
    """

    categorias = serializers.SerializerMethodField()
    categorias_count = serializers.SerializerMethodField()

    class Meta:
        model = Sala
        fields = (
            "id",
            "nombre",
            "capacidad_simultanea",
            "categorias",
            "categorias_count",
        )

    def get_categorias(self, obj):
        return [{"id": cat.id, "nombre": cat.nombre} for cat in obj.categorias.all()]

    def get_categorias_count(self, obj):
        return obj.categorias.count()
