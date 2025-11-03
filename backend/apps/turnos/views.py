"""Views para la app de turnos"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Q
from datetime import datetime, timedelta

from .models import Turno, HistorialTurno
from .serializers import (
    TurnoListSerializer,
    TurnoDetailSerializer,
    TurnoCreateSerializer,
    TurnoUpdateSerializer,
    HistorialTurnoSerializer,
)
from apps.core.pagination import CustomPageNumberPagination


class TurnoViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar turnos

    Endpoints:
    - GET /api/turnos/ - Listar todos los turnos
    - GET /api/turnos/:id/ - Obtener un turno específico
    - POST /api/turnos/ - Crear un nuevo turno
    - PUT /api/turnos/:id/ - Actualizar un turno
    - PATCH /api/turnos/:id/ - Actualizar parcialmente un turno
    - DELETE /api/turnos/:id/ - Cancelar un turno
    - GET /api/turnos/mis_turnos/ - Turnos del usuario actual
    - GET /api/turnos/empleado/:empleado_id/ - Turnos de un empleado específico
    - GET /api/turnos/disponibilidad/ - Verificar disponibilidad
    - POST /api/turnos/:id/cambiar_estado/ - Cambiar estado del turno
    - GET /api/turnos/estadisticas/ - Estadísticas de turnos
    """

    queryset = Turno.objects.select_related(
        "cliente__user", "empleado__user", "servicio__categoria"
    ).all()
    permission_classes = [IsAuthenticated]
    pagination_class = CustomPageNumberPagination
    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    # Campos para búsqueda
    search_fields = [
        "cliente__user__first_name",
        "cliente__user__last_name",
        "cliente__user__email",
        "empleado__user__first_name",
        "empleado__user__last_name",
        "servicio__nombre",
        "servicio__categoria__nombre",
    ]

    # Campos para filtrado
    filterset_fields = ["estado", "empleado", "cliente", "servicio"]

    # Campos para ordenamiento
    ordering_fields = ["fecha_hora", "created_at", "precio_final"]
    ordering = ["-fecha_hora"]

    def get_serializer_class(self):
        """Retornar el serializer apropiado según la acción"""
        if self.action == "list":
            return TurnoListSerializer
        elif self.action == "create":
            return TurnoCreateSerializer
        elif self.action in ["update", "partial_update"]:
            return TurnoUpdateSerializer
        else:
            return TurnoDetailSerializer

    def get_queryset(self):
        """Filtrar turnos según el rol del usuario"""
        user = self.request.user
        queryset = super().get_queryset()

        # Si es cliente, solo ver sus propios turnos
        if hasattr(user, "cliente_profile"):
            queryset = queryset.filter(cliente=user.cliente_profile)

        # Si es empleado, ver sus turnos asignados
        elif hasattr(user, "empleado_profile"):
            queryset = queryset.filter(empleado=user.empleado_profile)

        # Admin y propietario ven todos
        # queryset ya tiene todos los turnos

        # Filtrar por rango de fechas si se proporcionan
        fecha_desde = self.request.query_params.get("fecha_desde")
        fecha_hasta = self.request.query_params.get("fecha_hasta")

        if fecha_desde:
            # Filtrar turnos desde el inicio del día
            queryset = queryset.filter(fecha_hora__date__gte=fecha_desde)

        if fecha_hasta:
            # Filtrar turnos hasta el final del día
            queryset = queryset.filter(fecha_hora__date__lte=fecha_hasta)

        return queryset

    def perform_create(self, serializer):
        """Crear turno y registrar en historial"""
        turno = serializer.save()

        # Registrar en historial
        HistorialTurno.objects.create(
            turno=turno,
            usuario=self.request.user,
            accion="Turno creado",
            estado_nuevo=turno.estado,
            observaciones=f"Turno creado por {self.request.user.full_name}",
        )

    def perform_update(self, serializer):
        """Actualizar turno y registrar cambios en historial"""
        turno_anterior = self.get_object()
        estado_anterior = turno_anterior.estado

        turno = serializer.save()

        # Registrar cambio de estado en historial
        if estado_anterior != turno.estado:
            HistorialTurno.objects.create(
                turno=turno,
                usuario=self.request.user,
                accion="Cambio de estado",
                estado_anterior=estado_anterior,
                estado_nuevo=turno.estado,
                observaciones=f"Estado cambiado por {self.request.user.full_name}",
            )

    def destroy(self, request, *args, **kwargs):
        """Cancelar turno en lugar de eliminar"""
        turno = self.get_object()

        if not turno.puede_cancelar():
            return Response(
                {"error": "Este turno no puede ser cancelado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        turno.estado = "cancelado"
        turno.save()

        # Registrar en historial
        HistorialTurno.objects.create(
            turno=turno,
            usuario=request.user,
            accion="Turno cancelado",
            estado_anterior=turno.estado,
            estado_nuevo="cancelado",
            observaciones=f"Turno cancelado por {request.user.full_name}",
        )

        return Response(
            {"message": "Turno cancelado exitosamente"}, status=status.HTTP_200_OK
        )

    @action(detail=False, methods=["get"])
    def mis_turnos(self, request):
        """Obtener turnos del usuario actual"""
        user = request.user

        # Determinar si es cliente o empleado
        if hasattr(user, "cliente_profile"):
            turnos = self.get_queryset().filter(cliente=user.cliente_profile)
        elif hasattr(user, "empleado_profile"):
            turnos = self.get_queryset().filter(empleado=user.empleado_profile)
        else:
            return Response(
                {"error": "Usuario no tiene perfil de cliente o empleado"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Aplicar filtros opcionales
        estado = request.query_params.get("estado", None)
        if estado:
            turnos = turnos.filter(estado=estado)

        fecha_desde = request.query_params.get("fecha_desde", None)
        if fecha_desde:
            turnos = turnos.filter(fecha_hora__gte=fecha_desde)

        fecha_hasta = request.query_params.get("fecha_hasta", None)
        if fecha_hasta:
            turnos = turnos.filter(fecha_hora__lte=fecha_hasta)

        page = self.paginate_queryset(turnos)
        if page is not None:
            serializer = TurnoListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = TurnoListSerializer(turnos, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="empleado/(?P<empleado_id>[^/.]+)")
    def turnos_empleado(self, request, empleado_id=None):
        """Obtener turnos de un empleado específico con filtros de fecha"""
        if not empleado_id:
            return Response(
                {"error": "Debe proporcionar el ID del empleado"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from apps.empleados.models import Empleado

            empleado = Empleado.objects.get(id=empleado_id)
        except Empleado.DoesNotExist:
            return Response(
                {"error": "Empleado no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Filtrar turnos del empleado
        turnos = self.queryset.filter(empleado=empleado)

        # Aplicar filtros de fecha
        fecha_desde = request.query_params.get("fecha_desde")
        fecha_hasta = request.query_params.get("fecha_hasta")

        if fecha_desde:
            turnos = turnos.filter(fecha_hora__date__gte=fecha_desde)

        if fecha_hasta:
            turnos = turnos.filter(fecha_hora__date__lte=fecha_hasta)

        # Filtrar por estado si se proporciona
        estado = request.query_params.get("estado")
        if estado:
            turnos = turnos.filter(estado=estado)

        # Ordenar por fecha
        turnos = turnos.order_by("-fecha_hora")

        # Paginar resultados
        page = self.paginate_queryset(turnos)
        if page is not None:
            serializer = TurnoListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = TurnoListSerializer(turnos, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def disponibilidad(self, request):
        """Verificar disponibilidad de horarios para un empleado y servicio"""
        empleado_id = request.query_params.get("empleado")
        servicio_id = request.query_params.get("servicio")
        fecha = request.query_params.get("fecha")  # Formato: YYYY-MM-DD

        if not all([empleado_id, servicio_id, fecha]):
            return Response(
                {"error": "Debe proporcionar empleado, servicio y fecha"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from apps.empleados.models import Empleado, HorarioEmpleado
            from apps.servicios.models import Servicio

            empleado = Empleado.objects.get(id=empleado_id)
            servicio = Servicio.objects.get(id=servicio_id)
            fecha_obj = datetime.strptime(fecha, "%Y-%m-%d").date()

            # Obtener día de la semana (0 = Lunes, 6 = Domingo)
            dia_semana = fecha_obj.weekday()

            # Obtener horarios del empleado para ese día
            horarios_dia = HorarioEmpleado.objects.filter(
                empleado=empleado, dia_semana=dia_semana, is_active=True
            ).order_by("hora_inicio")

            # Si no tiene horarios configurados para ese día
            if not horarios_dia.exists():
                return Response(
                    {
                        "disponible": False,
                        "mensaje": "El empleado no trabaja ese día",
                        "horarios": [],
                    }
                )

            # Generar horarios disponibles para todos los rangos del día
            horarios_disponibles = []
            incremento = timedelta(minutes=30)

            for horario_rango in horarios_dia:
                # Crear datetime aware (con zona horaria)
                hora_actual = timezone.make_aware(
                    datetime.combine(fecha_obj, horario_rango.hora_inicio)
                )
                hora_fin = timezone.make_aware(
                    datetime.combine(fecha_obj, horario_rango.hora_fin)
                )

                while (
                    hora_actual + timedelta(minutes=servicio.duracion_minutos)
                    <= hora_fin
                ):
                    # Verificar si hay turno en ese horario
                    hora_fin_turno = hora_actual + timedelta(
                        minutes=servicio.duracion_minutos
                    )

                    conflicto = Turno.objects.filter(
                        empleado=empleado,
                        fecha_hora__lt=hora_fin_turno,
                        fecha_hora__gte=hora_actual,
                        estado__in=["pendiente", "confirmado", "en_proceso"],
                    ).exists()

                    if not conflicto and hora_actual > timezone.now():
                        hora_str = hora_actual.strftime("%H:%M")
                        # Evitar duplicados si hay rangos que se solapan
                        if hora_str not in horarios_disponibles:
                            horarios_disponibles.append(hora_str)

                    hora_actual += incremento

            return Response(
                {
                    "disponible": len(horarios_disponibles) > 0,
                    "empleado": empleado.nombre_completo,
                    "servicio": servicio.nombre,
                    "fecha": fecha,
                    "horarios": sorted(
                        horarios_disponibles
                    ),  # Ordenar cronológicamente
                }
            )

        except Empleado.DoesNotExist:
            return Response(
                {"error": "Empleado no encontrado"}, status=status.HTTP_404_NOT_FOUND
            )
        except Servicio.DoesNotExist:
            return Response(
                {"error": "Servicio no encontrado"}, status=status.HTTP_404_NOT_FOUND
            )
        except ValueError:
            return Response(
                {"error": "Formato de fecha inválido. Use YYYY-MM-DD"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["post"])
    def cambiar_estado(self, request, pk=None):
        """Cambiar el estado de un turno"""
        turno = self.get_object()
        nuevo_estado = request.data.get("estado")
        observaciones = request.data.get("observaciones", "")

        if not nuevo_estado:
            return Response(
                {"error": "Debe proporcionar un nuevo estado"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        estado_anterior = turno.estado
        turno.estado = nuevo_estado

        try:
            turno.full_clean()
            turno.save()

            # Registrar en historial
            HistorialTurno.objects.create(
                turno=turno,
                usuario=request.user,
                accion="Cambio de estado",
                estado_anterior=estado_anterior,
                estado_nuevo=nuevo_estado,
                observaciones=observaciones
                or f"Estado cambiado por {request.user.full_name}",
            )

            serializer = TurnoDetailSerializer(turno)
            return Response(serializer.data)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"])
    def estadisticas(self, request):
        """Obtener estadísticas de turnos"""
        # Filtros opcionales
        fecha_desde = request.query_params.get("fecha_desde")
        fecha_hasta = request.query_params.get("fecha_hasta")

        queryset = self.get_queryset()

        if fecha_desde:
            queryset = queryset.filter(fecha_hora__gte=fecha_desde)
        if fecha_hasta:
            queryset = queryset.filter(fecha_hora__lte=fecha_hasta)

        # Estadísticas por estado
        estadisticas = {
            "total": queryset.count(),
            "por_estado": {},
            "ingresos_totales": 0,
        }

        for estado, nombre in Turno.ESTADO_CHOICES:
            count = queryset.filter(estado=estado).count()
            estadisticas["por_estado"][nombre] = count

        # Calcular ingresos
        turnos_completados = queryset.filter(estado="completado")
        ingresos = sum([t.precio_final for t in turnos_completados if t.precio_final])
        estadisticas["ingresos_totales"] = float(ingresos)

        return Response(estadisticas)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def historial_turno(request, turno_id):
    """Obtener el historial de cambios de un turno"""
    try:
        turno = Turno.objects.get(id=turno_id)

        # Verificar permisos
        user = request.user
        if not (
            user.is_staff
            or (
                hasattr(user, "cliente_profile")
                and turno.cliente == user.cliente_profile
            )
            or (
                hasattr(user, "empleado_profile")
                and turno.empleado == user.empleado_profile
            )
        ):
            return Response(
                {"error": "No tiene permisos para ver este historial"},
                status=status.HTTP_403_FORBIDDEN,
            )

        historial = HistorialTurno.objects.filter(turno=turno)
        serializer = HistorialTurnoSerializer(historial, many=True)
        return Response(serializer.data)

    except Turno.DoesNotExist:
        return Response(
            {"error": "Turno no encontrado"}, status=status.HTTP_404_NOT_FOUND
        )
