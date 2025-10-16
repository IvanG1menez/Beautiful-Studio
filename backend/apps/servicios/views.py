from rest_framework import generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import CategoriaServicio, Servicio
from .serializers import (
    CategoriaServicioSerializer,
    ServicioSerializer,
    ServicioListSerializer,
)


class CategoriaServicioListView(generics.ListCreateAPIView):
    """
    Vista para listar y crear categorías de servicios
    """

    serializer_class = CategoriaServicioSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        # Si el usuario es admin, mostrar todas las categorías
        # Si no, solo las activas
        if self.request.user.is_authenticated and (
            self.request.user.is_staff
            or self.request.user.role in ["admin", "propietario"]
        ):
            return CategoriaServicio.objects.all()
        return CategoriaServicio.objects.filter(is_active=True)


class CategoriaServicioDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Vista para ver, actualizar y eliminar categorías de servicios
    """

    queryset = CategoriaServicio.objects.all()
    serializer_class = CategoriaServicioSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class ServicioListView(generics.ListCreateAPIView):
    """
    Vista para listar y crear servicios
    """

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        # Si el usuario es admin, mostrar todos los servicios
        # Si no, solo los activos
        if self.request.user.is_authenticated and (
            self.request.user.is_staff
            or self.request.user.role in ["admin", "propietario"]
        ):
            return Servicio.objects.all().select_related("categoria")
        return Servicio.objects.filter(is_active=True).select_related("categoria")

    def get_serializer_class(self):
        if self.request.method == "GET":
            return ServicioListSerializer
        return ServicioSerializer


class ServicioDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Vista para ver, actualizar y eliminar servicios
    """

    queryset = Servicio.objects.all()
    serializer_class = ServicioSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def servicios_por_categoria(request, categoria_id):
    """
    Vista para obtener servicios de una categoría específica
    """
    try:
        categoria = CategoriaServicio.objects.get(id=categoria_id, is_active=True)
        servicios = Servicio.objects.filter(categoria=categoria, is_active=True)
        serializer = ServicioListSerializer(servicios, many=True)
        return Response({"categoria": categoria.nombre, "servicios": serializer.data})
    except CategoriaServicio.DoesNotExist:
        return Response({"error": "Categoría no encontrada"}, status=404)
