from rest_framework import serializers
from .models import CategoriaServicio, Servicio

class CategoriaServicioSerializer(serializers.ModelSerializer):
    """
    Serializador para CategoriaServicio
    """
    class Meta:
        model = CategoriaServicio
        fields = '__all__'

class ServicioSerializer(serializers.ModelSerializer):
    """
    Serializador para Servicio
    """
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    duracion_horas = serializers.ReadOnlyField()
    
    class Meta:
        model = Servicio
        fields = ('id', 'nombre', 'descripcion', 'categoria', 'categoria_nombre',
                 'precio', 'duracion_minutos', 'duracion_horas', 'is_active',
                 'created_at', 'updated_at')
        read_only_fields = ('created_at', 'updated_at')

class ServicioListSerializer(serializers.ModelSerializer):
    """
    Serializador simplificado para listado de servicios
    """
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    duracion_horas = serializers.ReadOnlyField()
    
    class Meta:
        model = Servicio
        fields = ('id', 'nombre', 'categoria_nombre', 'precio', 'duracion_horas')