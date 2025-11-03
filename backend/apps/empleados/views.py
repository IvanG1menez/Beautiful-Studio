from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import Empleado
from .serializers import (
    EmpleadoSerializer,
    EmpleadoListSerializer,
)


class IsPropietarioOrAdmin(permissions.BasePermission):
    """
    Permiso personalizado que solo permite acceso a propietarios y administradores
    """

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.is_staff or request.user.role in ["admin", "propietario"]


class EmpleadoListView(generics.ListCreateAPIView):
    """
    Vista para listar y crear empleados/profesionales
    Solo accesible para propietarios y administradores
    """

    permission_classes = [IsPropietarioOrAdmin]

    def get_queryset(self):
        return Empleado.objects.select_related("user")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return EmpleadoSerializer
        return EmpleadoListSerializer


class EmpleadoDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Vista para ver, actualizar y eliminar empleados/profesionales
    Solo accesible para propietarios y administradores
    """

    queryset = Empleado.objects.select_related("user")
    serializer_class = EmpleadoSerializer
    permission_classes = [IsPropietarioOrAdmin]


@api_view(["GET", "PATCH"])
@permission_classes([permissions.IsAuthenticated])
def empleado_me_view(request):
    """
    Vista para obtener y actualizar el perfil del empleado autenticado
    """
    try:
        empleado = Empleado.objects.select_related("user").get(user=request.user)
    except Empleado.DoesNotExist:
        return Response(
            {
                "error": "No se encontró un perfil de empleado para este usuario",
                "error_code": "EMPLEADO_NOT_FOUND",
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == "GET":
        serializer = EmpleadoSerializer(empleado)
        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method == "PATCH":
        # Solo permitir actualizar datos del usuario, no del empleado
        user_data = request.data.get("user", {})
        user = empleado.user

        # Actualizar campos permitidos del usuario
        if "first_name" in user_data:
            user.first_name = user_data["first_name"]
        if "last_name" in user_data:
            user.last_name = user_data["last_name"]
        if "email" in user_data:
            user.email = user_data["email"]
        if "phone" in user_data:
            user.phone = user_data.get("phone")
        if "dni" in user_data:
            user.dni = user_data.get("dni")

        try:
            user.save()
            empleado.refresh_from_db()
            serializer = EmpleadoSerializer(empleado)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {
                    "error": f"Error al actualizar perfil: {str(e)}",
                    "error_code": "UPDATE_ERROR",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
