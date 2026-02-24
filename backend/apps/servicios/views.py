from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from .models import CategoriaServicio, Servicio, Sala
from .serializers import (
    CategoriaServicioSerializer,
    ServicioSerializer,
    ServicioListSerializer,
    SalaSerializer,
)


class IsPropietarioOrAdmin(permissions.BasePermission):
    """Permisos para propietario/admin en endpoints de infraestructura."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.is_staff or user.role in ["propietario", "superusuario"]


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
            return CategoriaServicio.objects.select_related("sala").all()
        return CategoriaServicio.objects.filter(is_active=True).select_related("sala")


class CategoriaServicioDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Vista para ver, actualizar y eliminar categorías de servicios
    """

    queryset = CategoriaServicio.objects.select_related("sala").all()
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


class SalaListView(generics.ListCreateAPIView):
    """
    Vista para listar y crear salas
    """

    serializer_class = SalaSerializer
    permission_classes = [IsPropietarioOrAdmin]
    queryset = Sala.objects.prefetch_related("categorias").all()


class SalaDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Vista para ver, actualizar y eliminar salas
    """

    serializer_class = SalaSerializer
    permission_classes = [IsPropietarioOrAdmin]
    queryset = Sala.objects.prefetch_related("categorias").all()

    def destroy(self, request, *args, **kwargs):
        sala = self.get_object()
        from apps.turnos.models import Turno

        tiene_turnos_futuros = Turno.objects.filter(
            sala=sala,
            fecha_hora__gte=timezone.now(),
            estado__in=["pendiente", "confirmado", "en_proceso"],
        ).exists()

        if tiene_turnos_futuros:
            return Response(
                {
                    "error": "No se puede eliminar una sala con turnos futuros pendientes."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().destroy(request, *args, **kwargs)


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
