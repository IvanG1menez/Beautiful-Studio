from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Count, Avg, Sum, Q
from django.utils import timezone
from datetime import timedelta
from django.db.models import ProtectedError
from .models import Empleado, HorarioEmpleado, EmpleadoServicio
from .serializers import (
    EmpleadoSerializer,
    EmpleadoListSerializer,
    HorarioEmpleadoSerializer,
    EmpleadoServicioSerializer,
)
from apps.authentication.pagination import CustomPageNumberPagination
from rest_framework.decorators import action
from rest_framework.viewsets import ReadOnlyModelViewSet
from django.shortcuts import get_object_or_404


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
    - ordering: Campo para ordenar (por defecto: nombre)
    """

    permission_classes = [permissions.IsAuthenticated]
    pagination_class = CustomPageNumberPagination
    ordering_fields = ["user__first_name"]
    ordering = ["user__first_name"]

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

        # Aplicar ordenamiento (por defecto: nombre del usuario)
        ordering_param = self.request.query_params.get("ordering", "user__first_name")
        if ordering_param:
            field = ordering_param.lstrip("-")
            if field in self.ordering_fields:
                queryset = queryset.order_by(ordering_param)
            else:
                queryset = queryset.order_by("user__first_name")
        else:
            queryset = queryset.order_by("user__first_name")

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

    def destroy(self, request, *args, **kwargs):
        """Dar de baja lógica al profesional en lugar de eliminarlo.

        Si un borrado físico llegara a violar integridad referencial
        (ProtectedError), se responde con 400 y un mensaje descriptivo.
        """
        empleado = self.get_object()
        user = empleado.user

        try:
            empleado.is_active = False
            empleado.save()

            if user:
                user.is_active = False
                user.save()

            serializer = self.get_serializer(empleado)
            return Response(
                {
                    "message": "Profesional desactivado exitosamente",
                    "data": serializer.data,
                },
                status=status.HTTP_200_OK,
            )
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


class EmpleadoServicioListView(generics.ListCreateAPIView):
    """Lista los servicios asociados a un profesional concreto.

    Endpoint esperado por el frontend:
    GET /empleados/<empleado_id>/servicios/

    Devuelve un listado paginado de EmpleadoServicio para ese profesional.
    """

    serializer_class = EmpleadoServicioSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = CustomPageNumberPagination

    def get_queryset(self):
        empleado_id = self.kwargs.get("empleado_id")
        return (
            EmpleadoServicio.objects.filter(empleado_id=empleado_id)
            .select_related("empleado", "servicio", "servicio__categoria")
            .order_by("servicio__categoria__nombre", "servicio__nombre")
        )

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsPropietarioOrAdmin()]
        return [permissions.IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        """Asociar/actualizar el servicio principal de un profesional.

        Acepta cualquiera de estas claves en el body:
        - servicio (int)
        - servicio_id (int)
        - especialidades (string/int)
        """
        empleado_id = self.kwargs.get("empleado_id")
        empleado = get_object_or_404(Empleado, id=empleado_id)

        servicio_id = (
            request.data.get("servicio")
            or request.data.get("servicio_id")
            or request.data.get("especialidades")
        )
        nivel_experiencia = request.data.get("nivel_experiencia", 3)

        if not servicio_id:
            return Response(
                {"error": "Debe enviar el servicio a asociar"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            servicio_id = int(servicio_id)
            nivel_experiencia = int(nivel_experiencia)
        except (TypeError, ValueError):
            return Response(
                {"error": "servicio y nivel_experiencia deben ser numéricos"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Esta UI maneja un servicio principal: limpiamos asociaciones previas.
        EmpleadoServicio.objects.filter(empleado=empleado).exclude(
            servicio_id=servicio_id
        ).delete()

        relacion, _ = EmpleadoServicio.objects.update_or_create(
            empleado=empleado,
            servicio_id=servicio_id,
            defaults={"nivel_experiencia": nivel_experiencia},
        )

        serializer = self.get_serializer(relacion)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


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


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def dias_trabajo_empleado(request, empleado_id):
    """
    Obtener los días de la semana que trabaja un profesional.
    Retorna un array con los números de días (0=Lunes, 6=Domingo)
    """
    try:
        empleado = Empleado.objects.get(id=empleado_id)
    except Empleado.DoesNotExist:
        return Response(
            {"error": "Empleado no encontrado"}, status=status.HTTP_404_NOT_FOUND
        )

    # Obtener días únicos de los horarios del empleado
    dias_trabajo = (
        HorarioEmpleado.objects.filter(empleado=empleado, is_active=True)
        .values_list("dia_semana", flat=True)
        .distinct()
        .order_by("dia_semana")
    )

    # Mapeo de nombres de días
    dias_nombres = {
        0: "Lunes",
        1: "Martes",
        2: "Miércoles",
        3: "Jueves",
        4: "Viernes",
        5: "Sábado",
        6: "Domingo",
    }

    dias_detallados = [
        {"numero": dia, "nombre": dias_nombres.get(dia, "")} for dia in dias_trabajo
    ]

    return Response(
        {
            "empleado_id": empleado.id,
            "empleado_nombre": empleado.nombre_completo,
            "dias_trabajo": list(dias_trabajo),
            "dias_detallados": dias_detallados,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def empleado_stats(request, empleado_id):
    """Obtener estadísticas del profesional (turnos e ingresos)."""
    try:
        empleado = Empleado.objects.get(id=empleado_id)
    except Empleado.DoesNotExist:
        return Response(
            {"error": "Empleado no encontrado"}, status=status.HTTP_404_NOT_FOUND
        )

    # Verificar que el usuario es el profesional o tiene permisos de propietario
    if request.user.role == "profesional" and empleado.user != request.user:
        return Response(
            {"error": "No tiene permisos para ver estas estadísticas"},
            status=status.HTTP_403_FORBIDDEN,
        )

    now = timezone.now()
    today = now.date()

    # Inicio de la semana (lunes)
    start_of_week = today - timedelta(days=today.weekday())
    end_of_week = start_of_week + timedelta(days=6)

    # Inicio del mes
    start_of_month = today.replace(day=1)

    # Importar Turno aquí para evitar importación circular
    from apps.turnos.models import Turno

    # Turnos de hoy
    turnos_hoy = (
        Turno.objects.filter(
            empleado=empleado,
            fecha_hora__date=today,
        )
        .exclude(estado="cancelado")
        .count()
    )

    # Turnos de esta semana
    turnos_semana = (
        Turno.objects.filter(
            empleado=empleado,
            fecha_hora__date__gte=start_of_week,
            fecha_hora__date__lte=end_of_week,
        )
        .exclude(estado="cancelado")
        .count()
    )

    # Turnos completados del mes
    turnos_completados = Turno.objects.filter(
        empleado=empleado,
        estado="completado",
        fecha_hora__date__gte=start_of_month,
    ).count()

    # Ingresos del mes
    ingresos_mes = (
        Turno.objects.filter(
            empleado=empleado,
            estado="completado",
            fecha_hora__date__gte=start_of_month,
        ).aggregate(total=Sum("precio_final"))["total"]
        or 0
    )

    return Response(
        {
            "turnos_hoy": turnos_hoy,
            "turnos_semana": turnos_semana,
            "turnos_completados": turnos_completados,
            "ingresos_mes": float(ingresos_mes),
        },
        status=status.HTTP_200_OK,
    )
