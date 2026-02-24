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
    duracion_horas = serializers.ReadOnlyField()

    class Meta:
        model = Servicio
        fields = (
            "id",
            "nombre",
            "descripcion",
            "categoria",
            "categoria_nombre",
            "precio",
            "descuento_reasignacion",
            "permite_reacomodamiento",
            "tipo_descuento_adelanto",
            "valor_descuento_adelanto",
            "tiempo_espera_respuesta",
            "porcentaje_sena",
            "duracion_minutos",
            "duracion_horas",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class ServicioListSerializer(serializers.ModelSerializer):
    """
    Serializador simplificado para listado de servicios
    """

    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)
    duracion_horas = serializers.ReadOnlyField()

    class Meta:
        model = Servicio
        fields = (
            "id",
            "nombre",
            "descripcion",
            "categoria",
            "categoria_nombre",
            "precio",
            "descuento_reasignacion",
            "permite_reacomodamiento",
            "tipo_descuento_adelanto",
            "valor_descuento_adelanto",
            "tiempo_espera_respuesta",
            "porcentaje_sena",
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
