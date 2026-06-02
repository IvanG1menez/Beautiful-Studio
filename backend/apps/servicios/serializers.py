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
    sala_is_active = serializers.BooleanField(
        source="sala.is_active", read_only=True, allow_null=True
    )
    servicios_count = serializers.SerializerMethodField()
    servicios_activos_count = serializers.SerializerMethodField()

    class Meta:
        model = CategoriaServicio
        fields = "__all__"

    def get_servicios_count(self, obj):
        return obj.servicios.count()

    def get_servicios_activos_count(self, obj):
        return obj.servicios.filter(is_active=True).count()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        is_active = attrs.get(
            "is_active", getattr(self.instance, "is_active", True)
        )
        sala = attrs.get("sala", getattr(self.instance, "sala", None))

        if is_active and sala and not sala.is_active:
            raise serializers.ValidationError(
                {
                    "sala": (
                        "No se puede activar una categoría vinculada a una sala inactiva. "
                        "Reactivá la sala o reasigná la categoría primero."
                    )
                }
            )

        if self.instance and attrs.get("is_active") is False:
            servicios_activos = self.instance.servicios.filter(is_active=True).count()
            if servicios_activos:
                raise serializers.ValidationError(
                    {
                        "is_active": (
                            "No se puede desactivar la categoría porque tiene "
                            f"{servicios_activos} servicio(s) activo(s). "
                            "Desactivá o reasigná esos servicios primero."
                        )
                    }
                )
        return attrs


class ServicioSerializer(serializers.ModelSerializer):
    """
    Serializador para Servicio
    """

    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)
    categoria_is_active = serializers.BooleanField(
        source="categoria.is_active", read_only=True
    )
    sala_nombre = serializers.CharField(
        source="categoria.sala.nombre", read_only=True, allow_null=True
    )
    sala_is_active = serializers.BooleanField(
        source="categoria.sala.is_active", read_only=True, allow_null=True
    )
    duracion_horas = serializers.ReadOnlyField()
    turnos_count = serializers.SerializerMethodField()
    turnos_futuros_activos_count = serializers.SerializerMethodField()
    profesionales_asociados_count = serializers.SerializerMethodField()

    class Meta:
        model = Servicio
        fields = (
            "id",
            "nombre",
            "descripcion",
            "categoria",
            "categoria_nombre",
            "categoria_is_active",
            "sala_nombre",
            "sala_is_active",
            "precio",
            "descuento_reasignacion",
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
            "turnos_count",
            "turnos_futuros_activos_count",
            "profesionales_asociados_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def validate(self, attrs):
        attrs = super().validate(attrs)

        is_active = attrs.get(
            "is_active", getattr(self.instance, "is_active", True)
        )
        categoria = attrs.get("categoria", getattr(self.instance, "categoria", None))

        if is_active and categoria:
            if not categoria.is_active:
                raise serializers.ValidationError(
                    {
                        "categoria": (
                            "No se puede activar un servicio vinculado a una categoría inactiva. "
                            "Reactivá la categoría o reasigná el servicio primero."
                        )
                    }
                )
            if categoria.sala and not categoria.sala.is_active:
                raise serializers.ValidationError(
                    {
                        "categoria": (
                            "No se puede activar un servicio vinculado a una sala inactiva. "
                            "Reactivá la sala o reasigná la categoría primero."
                        )
                    }
                )

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

        if self.instance and attrs.get("is_active") is False:
            turnos_futuros = self.get_turnos_futuros_activos_count(self.instance)
            if turnos_futuros:
                raise serializers.ValidationError(
                    {
                        "is_active": (
                            "No se puede desactivar el servicio porque tiene "
                            f"{turnos_futuros} turno(s) futuro(s) activo(s). "
                            "Reprogramá o cancelá esos turnos primero."
                        )
                    }
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

    def get_turnos_count(self, obj):
        return obj.turnos.count()

    def get_turnos_futuros_activos_count(self, obj):
        from django.utils import timezone

        return obj.turnos.filter(
            fecha_hora__gte=timezone.now(),
            estado__in=["pendiente", "confirmado", "en_proceso"],
        ).count()

    def get_profesionales_asociados_count(self, obj):
        return obj.profesionales_disponibles.count()


class ServicioListSerializer(serializers.ModelSerializer):
    """
    Serializador simplificado para listado de servicios
    """

    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)
    categoria_is_active = serializers.BooleanField(
        source="categoria.is_active", read_only=True
    )
    sala_nombre = serializers.CharField(
        source="categoria.sala.nombre", read_only=True, allow_null=True
    )
    sala_is_active = serializers.BooleanField(
        source="categoria.sala.is_active", read_only=True, allow_null=True
    )
    duracion_horas = serializers.ReadOnlyField()
    turnos_count = serializers.SerializerMethodField()
    turnos_futuros_activos_count = serializers.SerializerMethodField()
    profesionales_asociados_count = serializers.SerializerMethodField()

    class Meta:
        model = Servicio
        fields = (
            "id",
            "nombre",
            "descripcion",
            "categoria",
            "categoria_nombre",
            "categoria_is_active",
            "sala_nombre",
            "sala_is_active",
            "precio",
            "descuento_reasignacion",
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
            "turnos_count",
            "turnos_futuros_activos_count",
            "profesionales_asociados_count",
        )

    def get_turnos_count(self, obj):
        return obj.turnos.count()

    def get_turnos_futuros_activos_count(self, obj):
        from django.utils import timezone

        return obj.turnos.filter(
            fecha_hora__gte=timezone.now(),
            estado__in=["pendiente", "confirmado", "en_proceso"],
        ).count()

    def get_profesionales_asociados_count(self, obj):
        return obj.profesionales_disponibles.count()


class SalaSerializer(serializers.ModelSerializer):
    """
    Serializador para Sala
    """

    categorias = serializers.SerializerMethodField()
    categorias_count = serializers.SerializerMethodField()
    categorias_activas_count = serializers.SerializerMethodField()
    turnos_count = serializers.SerializerMethodField()
    turnos_futuros_activos_count = serializers.SerializerMethodField()

    class Meta:
        model = Sala
        fields = (
            "id",
            "nombre",
            "capacidad_simultanea",
            "is_active",
            "categorias",
            "categorias_count",
            "categorias_activas_count",
            "turnos_count",
            "turnos_futuros_activos_count",
        )

    def get_categorias(self, obj):
        return [{"id": cat.id, "nombre": cat.nombre} for cat in obj.categorias.all()]

    def get_categorias_count(self, obj):
        return obj.categorias.count()

    def get_categorias_activas_count(self, obj):
        return obj.categorias.filter(is_active=True).count()

    def get_turnos_count(self, obj):
        return obj.turnos.count()

    def get_turnos_futuros_activos_count(self, obj):
        from django.utils import timezone

        return obj.turnos.filter(
            fecha_hora__gte=timezone.now(),
            estado__in=["pendiente", "confirmado", "en_proceso"],
        ).count()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance and attrs.get("is_active") is False:
            categorias_activas = self.instance.categorias.filter(is_active=True).count()
            if categorias_activas:
                raise serializers.ValidationError(
                    {
                        "is_active": (
                            "No se puede desactivar la sala porque tiene "
                            f"{categorias_activas} categoría(s) activa(s). "
                            "Desactivá o reasigná esas categorías primero."
                        )
                    }
                )
        return attrs
