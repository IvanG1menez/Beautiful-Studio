from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import ProtectedError
from django.db.models import Q
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
        return CategoriaServicio.objects.filter(
            is_active=True
        ).filter(Q(sala__isnull=True) | Q(sala__is_active=True)).select_related(
            "sala"
        )


class CategoriaServicioDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Vista para ver, actualizar y eliminar categorías de servicios
    """

    queryset = CategoriaServicio.objects.select_related("sala").all()
    serializer_class = CategoriaServicioSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def destroy(self, request, *args, **kwargs):
        """Eliminar físicamente solo categorías sin servicios asociados."""
        categoria = self.get_object()

        servicios_count = categoria.servicios.count()
        if servicios_count:
            return Response(
                {
                    "error": (
                        "No se puede eliminar la categoría porque tiene "
                        f"{servicios_count} servicio(s) asociado(s). "
                        "Podés desactivarla cuando no tenga servicios activos."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().destroy(request, *args, **kwargs)


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
            return Servicio.objects.all().select_related("categoria", "categoria__sala")
        return Servicio.objects.filter(
            is_active=True,
            categoria__is_active=True,
        ).filter(
            Q(categoria__sala__isnull=True) | Q(categoria__sala__is_active=True)
        ).select_related("categoria", "categoria__sala")

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

    def destroy(self, request, *args, **kwargs):
        """Eliminar físicamente solo servicios sin historial ni dependencias."""
        servicio = self.get_object()

        turnos_count = servicio.turnos.count()
        if turnos_count:
            return Response(
                {
                    "error": (
                        "No se puede eliminar el servicio porque tiene "
                        f"{turnos_count} turno(s) asociado(s). "
                        "Podés desactivarlo si no tiene turnos futuros activos."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        profesionales_count = servicio.profesionales_disponibles.count()
        if profesionales_count:
            return Response(
                {
                    "error": (
                        "No se puede eliminar el servicio porque está asignado a "
                        f"{profesionales_count} profesional(es). "
                        "Quitá esas asignaciones primero."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "error": (
                        "No es posible eliminar este registro porque cuenta con "
                        "historial asociado. Se recomienda dar de baja (desactivar) "
                        "en su lugar."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )


class SalaListView(generics.ListCreateAPIView):
    """
    Vista para listar y crear salas
    """

    serializer_class = SalaSerializer
    permission_classes = [IsPropietarioOrAdmin]

    def get_queryset(self):
        queryset = Sala.objects.prefetch_related("categorias").all()
        user = self.request.user
        if user.is_staff or user.role in ["propietario", "superusuario"]:
            return queryset
        return queryset.filter(is_active=True)


class SalaDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Vista para ver, actualizar y eliminar salas
    """

    serializer_class = SalaSerializer
    permission_classes = [IsPropietarioOrAdmin]
    queryset = Sala.objects.prefetch_related("categorias").all()

    def destroy(self, request, *args, **kwargs):
        sala = self.get_object()

        categorias_count = sala.categorias.count()
        if categorias_count:
            return Response(
                {
                    "error": (
                        "No se puede eliminar la sala porque tiene "
                        f"{categorias_count} categoría(s) asociada(s). "
                        "Podés desactivarla cuando no tenga categorías activas."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        turnos_count = sala.turnos.count()
        if turnos_count:
            return Response(
                {
                    "error": (
                        "No se puede eliminar la sala porque tiene "
                        f"{turnos_count} turno(s) asociado(s)."
                    )
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
        categoria = CategoriaServicio.objects.filter(
            id=categoria_id,
            is_active=True,
        ).filter(Q(sala__isnull=True) | Q(sala__is_active=True)).get()
        servicios = Servicio.objects.filter(categoria=categoria, is_active=True)
        serializer = ServicioListSerializer(servicios, many=True)
        return Response({"categoria": categoria.nombre, "servicios": serializer.data})
    except CategoriaServicio.DoesNotExist:
        return Response({"error": "Categoría no encontrada"}, status=404)
