from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import Empleado, HorarioEmpleado
from .serializers import (
    EmpleadoSerializer,
    EmpleadoListSerializer,
    HorarioEmpleadoSerializer,
)
from apps.core.pagination import CustomPageNumberPagination


class IsPropietarioOrAdmin(permissions.BasePermission):
    """
    Permiso personalizado que solo permite acceso a propietarios y superusuarios
    """

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.is_staff or request.user.role in [
            "propietario",
            "superusuario",
        ]


class EmpleadoListView(generics.ListCreateAPIView):
    """
    Vista para listar y crear profesionales del salón.
    GET: Accesible para todos los usuarios autenticados (incluyendo clientes)
    POST: Solo accesible para propietarios y superusuarios

    Parámetros de consulta opcionales:
    - servicio: ID del servicio para filtrar profesionales que pueden realizarlo
    - disponible: true/false para filtrar por disponibilidad
    """

    permission_classes = [permissions.IsAuthenticated]
    pagination_class = CustomPageNumberPagination

    def get_queryset(self):
        queryset = Empleado.objects.select_related("user")

        # Filtrar por servicio si se proporciona
        servicio_id = self.request.query_params.get("servicio", None)
        if servicio_id:
            # Filtrar profesionales que pueden realizar este servicio
            queryset = queryset.filter(servicios_disponibles__servicio_id=servicio_id)

        # Filtrar por disponibilidad
        disponible = self.request.query_params.get("disponible", None)
        if disponible is not None:
            is_disponible = disponible.lower() == "true"
            queryset = queryset.filter(is_disponible=is_disponible)

        return queryset.distinct()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return EmpleadoSerializer
        return EmpleadoListSerializer

    def get_serializer_context(self):
        """Agregar request al contexto del serializer"""
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def get_permissions(self):
        # Solo propietario/superusuario puede crear profesionales
        if self.request.method == "POST":
            return [IsPropietarioOrAdmin()]
        # GET es accesible para usuarios autenticados
        return [permissions.IsAuthenticated()]


class EmpleadoDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Vista para ver, actualizar y eliminar profesionales del salón.
    Solo accesible para propietarios y superusuarios.
    """

    queryset = Empleado.objects.select_related("user")
    serializer_class = EmpleadoSerializer
    permission_classes = [IsPropietarioOrAdmin]


@api_view(["GET", "PATCH"])
@permission_classes([permissions.IsAuthenticated])
def empleado_me_view(request):
    """
    Vista para obtener y actualizar el perfil del profesional autenticado.
    Accesible solo para usuarios con rol 'profesional'.
    """
    try:
        empleado = Empleado.objects.select_related("user").get(user=request.user)
    except Empleado.DoesNotExist:
        return Response(
            {
                "error": "No se encontró un perfil de profesional para este usuario",
                "error_code": "PROFESIONAL_NOT_FOUND",
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


class HorarioEmpleadoListCreateView(generics.ListCreateAPIView):
    """
    Vista para listar y crear horarios de empleados
    Parámetros opcionales:
    - empleado: ID del empleado para filtrar sus horarios

    GET: Accesible para todos los usuarios autenticados
         Los profesionales solo pueden ver sus propios horarios
    POST: Solo propietarios y superusuarios
    """

    serializer_class = HorarioEmpleadoSerializer
    pagination_class = CustomPageNumberPagination

    def get_permissions(self):
        # Solo propietario/superusuario puede crear horarios
        if self.request.method == "POST":
            return [IsPropietarioOrAdmin()]
        # GET es accesible para usuarios autenticados
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = HorarioEmpleado.objects.select_related("empleado", "empleado__user")
        empleado_id = self.request.query_params.get("empleado", None)

        # Si el usuario es profesional, solo puede ver sus propios horarios
        if self.request.user.role == "profesional":
            try:
                empleado = Empleado.objects.get(user=self.request.user)
                queryset = queryset.filter(empleado=empleado)
            except Empleado.DoesNotExist:
                return queryset.none()
        elif empleado_id:
            # Propietarios/superusuarios pueden filtrar por cualquier empleado
            queryset = queryset.filter(empleado_id=empleado_id)

        return queryset


class HorarioEmpleadoDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Vista para ver, actualizar y eliminar horarios de empleados"""

    queryset = HorarioEmpleado.objects.select_related("empleado", "empleado__user")
    serializer_class = HorarioEmpleadoSerializer
    permission_classes = [IsPropietarioOrAdmin]


@api_view(["POST"])
@permission_classes([IsPropietarioOrAdmin])
def bulk_update_horarios(request, empleado_id):
    """
    Actualizar todos los horarios de un empleado de una vez.
    Espera un array de horarios en el formato:
    {
        "horarios": [
            {"dia_semana": 0, "hora_inicio": "08:00", "hora_fin": "12:00"},
            {"dia_semana": 0, "hora_inicio": "14:00", "hora_fin": "18:00"},
            ...
        ]
    }
    """
    try:
        empleado = Empleado.objects.get(id=empleado_id)
    except Empleado.DoesNotExist:
        return Response(
            {"error": "Empleado no encontrado"}, status=status.HTTP_404_NOT_FOUND
        )

    horarios_data = request.data.get("horarios", [])

    if not isinstance(horarios_data, list):
        return Response(
            {"error": 'El campo "horarios" debe ser un array'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Eliminar horarios existentes
    HorarioEmpleado.objects.filter(empleado=empleado).delete()

    # Crear nuevos horarios
    created_horarios = []
    errors = []

    for idx, horario_data in enumerate(horarios_data):
        horario_data["empleado"] = empleado_id
        serializer = HorarioEmpleadoSerializer(data=horario_data)

        if serializer.is_valid():
            horario = serializer.save()
            created_horarios.append(serializer.data)
        else:
            errors.append(
                {"index": idx, "errors": serializer.errors, "data": horario_data}
            )

    if errors:
        return Response(
            {
                "message": f"Se crearon {len(created_horarios)} horarios con {len(errors)} errores",
                "created": created_horarios,
                "errors": errors,
            },
            status=status.HTTP_207_MULTI_STATUS,
        )

    return Response(
        {
            "message": f"Se crearon {len(created_horarios)} horarios exitosamente",
            "horarios": created_horarios,
        },
        status=status.HTTP_201_CREATED,
    )
