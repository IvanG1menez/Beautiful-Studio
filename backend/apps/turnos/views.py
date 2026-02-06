"""Views para la app de turnos"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from django.db.models import Q
from datetime import datetime, timedelta
from .models import Turno

from .models import Turno, HistorialTurno
from .serializers import (
    TurnoListSerializer,
    TurnoDetailSerializer,
    TurnoCreateSerializer,
    TurnoUpdateSerializer,
    HistorialTurnoSerializer,
)
from apps.authentication.pagination import CustomPageNumberPagination
from apps.turnos.services.reasignacion_service import responder_oferta_reasignacion


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

    serializer_class = TurnoListSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = CustomPageNumberPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]

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
        """
        Filtrar turnos según el rol del usuario y la acción.

        Para acciones de detalle (retrieve, update, partial_update, destroy),
        devolver el queryset completo sin filtros de rol para evitar 404.
        Para acciones de listado, aplicar filtros por rol.
        """
        user = self.request.user
        queryset = super().get_queryset()

        # Para acciones de detalle, devolver queryset completo sin filtros de rol
        # Esto permite que DRF encuentre el objeto por ID sin restricciones
        if self.action in [
            "retrieve",
            "update",
            "partial_update",
            "destroy",
            "cambiar_estado",
        ]:
            return queryset  # Sin filtros de rol, solo permisos generales

        # Para acciones de listado, aplicar filtros por rol
        # Si es cliente, solo ver sus propios turnos
        if hasattr(user, "cliente_profile"):
            queryset = queryset.filter(cliente=user.cliente_profile)

        # Si es profesional, ver sus turnos asignados
        elif hasattr(user, "profesional_profile"):
            queryset = queryset.filter(empleado=user.profesional_profile)

        # Admin y propietario ven todos
        # queryset ya tiene todos los turnos

        # Solo aplicar filtros de fecha en operaciones de listado
        if self.action in [
            "list",
            "turnos_empleado",
            "mis_turnos",
            "disponibilidad",
            "estadisticas",
        ]:
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

        # Determinar si es cliente o profesional
        if hasattr(user, "cliente_profile"):
            turnos = self.get_queryset().filter(cliente=user.cliente_profile)
        elif hasattr(user, "profesional_profile"):
            turnos = self.get_queryset().filter(empleado=user.profesional_profile)
        else:
            return Response(
                {"error": "Usuario no tiene perfil de cliente o profesional"},
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

            # Si no tiene horarios configurados en HorarioEmpleado, usar campos legacy
            if not horarios_dia.exists():
                # Verificar si el empleado trabaja ese día usando dias_trabajo
                dias_trabajo = empleado.dias_trabajo.split(",")
                dias_map = {"L": 0, "M": 1, "Mi": 2, "J": 3, "V": 4, "S": 5, "D": 6}

                # Convertir días de trabajo a números
                dias_numericos = []
                for dia in dias_trabajo:
                    dia = dia.strip()
                    # Manejar "Mi" (Miércoles) y "M" (Martes)
                    if dia == "X":  # Algunas bases usan X para miércoles
                        dias_numericos.append(2)
                    elif dia in dias_map:
                        dias_numericos.append(dias_map[dia])

                # Verificar si trabaja ese día
                if dia_semana not in dias_numericos:
                    return Response(
                        {
                            "disponible": False,
                            "mensaje": "El empleado no trabaja ese día",
                            "horarios": [],
                        }
                    )

                # Usar horario_entrada y horario_salida como un solo rango
                # Crear un objeto simulado para mantener la compatibilidad
                class HorarioLegacy:
                    def __init__(self, hora_inicio, hora_fin):
                        self.hora_inicio = hora_inicio
                        self.hora_fin = hora_fin

                horarios_dia = [
                    HorarioLegacy(empleado.horario_entrada, empleado.horario_salida)
                ]

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

    @action(detail=False, methods=["get"], url_path="metricas-propietario")
    def metricas_propietario(self, request):
        """
        Obtener métricas financieras y operativas para el propietario

        Retorna:
        - total_clientes: Total de clientes registrados
        - total_empleados: Total de empleados activos
        - turnos_hoy: Turnos programados para hoy
        - turnos_completados_hoy: Turnos completados hoy
        - ingresos_mes: Ingresos totales del mes actual
        - comision_pendiente: Suma de comisiones pendientes de pago
        - turnos_pendientes_pago: Turnos completados pendientes de pago
        - turnos_pendientes_aceptacion: Turnos en estado pendiente
        - turnos_proximos_48h: Turnos en las próximas 48 horas
        """
        from apps.clientes.models import Cliente
        from apps.empleados.models import Empleado
        from django.db.models import Sum, Count

        # Verificar que sea propietario o admin
        if request.user.role not in ["propietario", "superusuario"]:
            return Response(
                {"error": "No tiene permisos para ver estas métricas"},
                status=status.HTTP_403_FORBIDDEN,
            )

        now = timezone.now()
        today = now.date()
        start_of_month = today.replace(day=1)
        proximas_48h = now + timedelta(hours=48)

        # Total de clientes y empleados
        total_clientes = Cliente.objects.filter(user__is_active=True).count()
        total_empleados = Empleado.objects.filter(user__is_active=True).count()

        # Turnos de hoy
        turnos_hoy = (
            Turno.objects.filter(fecha_hora__date=today)
            .exclude(estado="cancelado")
            .count()
        )

        turnos_completados_hoy = Turno.objects.filter(
            fecha_hora__date=today, estado="completado"
        ).count()

        # Ingresos del mes
        ingresos_mes = (
            Turno.objects.filter(
                estado="completado", fecha_hora__date__gte=start_of_month
            ).aggregate(total=Sum("precio_final"))["total"]
            or 0
        )

        # Comisión pendiente (turnos completados sin marca de pago)
        # Asumiendo que hay un campo 'pagado' o similar en el modelo
        # Por ahora calculamos comisión como % de turnos completados
        comision_pendiente = (
            Turno.objects.filter(
                estado="completado",
                # Agregar filtro de pagado=False cuando exista el campo
            ).aggregate(total=Sum("precio_final"))["total"]
            or 0
        )

        # Aplicar % de comisión (por ejemplo 30%)
        porcentaje_comision = 0.30
        comision_pendiente = float(comision_pendiente) * porcentaje_comision

        # Turnos pendientes de pago (completados)
        turnos_pendientes_pago = Turno.objects.filter(
            estado="completado",
            # Agregar filtro de pagado=False cuando exista el campo
        ).count()

        # Turnos pendientes de aceptación
        turnos_pendientes_aceptacion = Turno.objects.filter(estado="pendiente").count()

        # Turnos en las próximas 48 horas
        turnos_proximos_48h = (
            Turno.objects.filter(fecha_hora__gte=now, fecha_hora__lte=proximas_48h)
            .exclude(estado__in=["cancelado", "no_asistio"])
            .count()
        )

        return Response(
            {
                "total_clientes": total_clientes,
                "total_empleados": total_empleados,
                "turnos_hoy": turnos_hoy,
                "turnos_completados_hoy": turnos_completados_hoy,
                "ingresos_mes": float(ingresos_mes),
                "comision_pendiente": comision_pendiente,
                "turnos_pendientes_pago": turnos_pendientes_pago,
                "turnos_pendientes_aceptacion": turnos_pendientes_aceptacion,
                "turnos_proximos_48h": turnos_proximos_48h,
            }
        )

    @action(detail=False, methods=["get"], url_path="turnos-accion")
    def turnos_accion(self, request):
        """
        Obtener turnos que requieren acción del propietario

        Query params:
        - tipo: 'proximos_48h' | 'pendientes_pago' | 'pendientes_aceptacion'
        - limit: número máximo de resultados (default: 20)
        """
        # Verificar que sea propietario o admin
        if request.user.role not in ["propietario", "superusuario"]:
            return Response(
                {"error": "No tiene permisos para ver estos turnos"},
                status=status.HTTP_403_FORBIDDEN,
            )

        tipo = request.query_params.get("tipo", "proximos_48h")
        limit = int(request.query_params.get("limit", 20))

        now = timezone.now()
        proximas_48h = now + timedelta(hours=48)

        if tipo == "proximos_48h":
            turnos = (
                Turno.objects.filter(fecha_hora__gte=now, fecha_hora__lte=proximas_48h)
                .exclude(estado__in=["cancelado", "no_asistio"])
                .select_related("cliente__user", "empleado__user", "servicio")
                .order_by("fecha_hora")[:limit]
            )

        elif tipo == "pendientes_pago":
            turnos = (
                Turno.objects.filter(
                    estado="completado",
                    # Agregar filtro de pagado=False cuando exista el campo
                )
                .select_related("cliente__user", "empleado__user", "servicio")
                .order_by("-fecha_hora")[:limit]
            )

        elif tipo == "pendientes_aceptacion":
            turnos = (
                Turno.objects.filter(estado="pendiente")
                .select_related("cliente__user", "empleado__user", "servicio")
                .order_by("fecha_hora")[:limit]
            )
        else:
            return Response(
                {
                    "error": "Tipo no válido. Use: proximos_48h, pendientes_pago, pendientes_aceptacion"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = TurnoListSerializer(turnos, many=True)

        return Response(
            {"tipo": tipo, "total": turnos.count(), "turnos": serializer.data}
        )

    @action(detail=False, methods=["post"], url_path="completar-masivo")
    def completar_masivo(self, request):
        """
        Marcar múltiples turnos como completados

        Parámetros:
        - turno_ids: Lista de IDs de turnos a completar
        - fecha_desde: Fecha inicio (opcional, si no se envían IDs)
        - fecha_hasta: Fecha fin (opcional, si no se envían IDs)

        Retorna:
        - completados: cantidad de turnos marcados como completados
        - errores: lista de errores si los hay
        """
        user = request.user

        # Verificar que el usuario sea profesional
        if not hasattr(user, "profesional_profile"):
            return Response(
                {
                    "error": "Solo los profesionales pueden marcar turnos como completados"
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        empleado = user.profesional_profile
        turno_ids = request.data.get("turno_ids", [])
        fecha_desde = request.data.get("fecha_desde")
        fecha_hasta = request.data.get("fecha_hasta")

        # Construir query base - solo turnos del profesional
        queryset = Turno.objects.filter(empleado=empleado)

        # Si se proporcionan IDs específicos
        if turno_ids:
            queryset = queryset.filter(id__in=turno_ids)
        # Si se proporciona rango de fechas
        elif fecha_desde and fecha_hasta:
            queryset = queryset.filter(
                fecha_hora__gte=fecha_desde, fecha_hora__lte=fecha_hasta
            )
        else:
            return Response(
                {
                    "error": "Debe proporcionar turno_ids o un rango de fechas (fecha_desde y fecha_hasta)"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Filtrar solo turnos que NO están ya completados o cancelados
        queryset = queryset.filter(estado__in=["pendiente", "confirmado", "en_proceso"])

        completados = 0
        errores = []

        for turno in queryset:
            try:
                turno.estado = "completado"
                turno.fecha_hora_completado = timezone.now()
                turno.save()
                completados += 1
            except Exception as e:
                errores.append({"turno_id": turno.id, "error": str(e)})

        return Response(
            {
                "success": True,
                "completados": completados,
                "total_seleccionados": queryset.count(),
                "errores": errores,
            }
        )

    @action(detail=False, methods=["post"], url_path="completar-ultima-semana")
    def completar_ultima_semana(self, request):
        """
        Marcar todos los turnos de la última semana como completados

        Retorna:
        - completados: cantidad de turnos marcados como completados
        - fecha_desde: fecha de inicio del rango
        - fecha_hasta: fecha de fin del rango
        """
        user = request.user

        # Verificar que el usuario sea profesional
        if not hasattr(user, "profesional_profile"):
            return Response(
                {
                    "error": "Solo los profesionales pueden marcar turnos como completados"
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        empleado = user.profesional_profile

        # Calcular fecha hace 7 días
        ahora = timezone.now()
        hace_7_dias = ahora - timedelta(days=7)

        # Buscar turnos de la última semana
        turnos = Turno.objects.filter(
            empleado=empleado,
            fecha_hora__gte=hace_7_dias,
            fecha_hora__lte=ahora,
            estado__in=["pendiente", "confirmado", "en_proceso"],
        )

        completados = 0
        errores = []

        for turno in turnos:
            try:
                turno.estado = "completado"
                turno.fecha_hora_completado = timezone.now()
                turno.save()
                completados += 1
            except Exception as e:
                errores.append({"turno_id": turno.id, "error": str(e)})

        return Response(
            {
                "success": True,
                "completados": completados,
                "total_encontrados": turnos.count(),
                "fecha_desde": hace_7_dias.isoformat(),
                "fecha_hasta": ahora.isoformat(),
                "errores": errores,
            }
        )

    @action(detail=False, methods=["get"], url_path="pendientes-rango")
    def pendientes_rango(self, request):
        """
        Obtener turnos pendientes en un rango de fechas para el profesional

        Parámetros:
        - fecha_desde: Fecha inicio (requerido)
        - fecha_hasta: Fecha fin (requerido)
        - estado: Filtrar por estado (opcional, por defecto: pendiente, confirmado, en_proceso)

        Retorna lista de turnos pendientes con información detallada
        """
        user = request.user

        # Verificar que el usuario sea profesional
        if not hasattr(user, "profesional_profile"):
            return Response(
                {"error": "Solo los profesionales pueden acceder a esta función"},
                status=status.HTTP_403_FORBIDDEN,
            )

        empleado = user.profesional_profile
        fecha_desde = request.query_params.get("fecha_desde")
        fecha_hasta = request.query_params.get("fecha_hasta")
        estado_filter = request.query_params.get("estado")

        if not fecha_desde or not fecha_hasta:
            return Response(
                {"error": "Debe proporcionar fecha_desde y fecha_hasta"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Construir query
        queryset = Turno.objects.filter(
            empleado=empleado, fecha_hora__gte=fecha_desde, fecha_hora__lte=fecha_hasta
        )

        # Filtrar por estado
        if estado_filter:
            queryset = queryset.filter(estado=estado_filter)
        else:
            # Por defecto, solo turnos que pueden completarse
            queryset = queryset.filter(
                estado__in=["pendiente", "confirmado", "en_proceso"]
            )

        # Ordenar por fecha
        queryset = queryset.order_by("fecha_hora")

        serializer = TurnoListSerializer(queryset, many=True)

        return Response(
            {
                "success": True,
                "total": queryset.count(),
                "fecha_desde": fecha_desde,
                "fecha_hasta": fecha_hasta,
                "turnos": serializer.data,
            }
        )


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
                hasattr(user, "profesional_profile")
                and turno.empleado == user.profesional_profile
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


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def responder_reasignacion(request, token):
    """Aceptar o rechazar una oferta de reasignación con token único."""
    accion = request.data.get("accion") or request.query_params.get("accion")

    if accion not in ["aceptar", "rechazar"]:
        return Response(
            {"error": "Acción inválida. Use 'aceptar' o 'rechazar'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    resultado = responder_oferta_reasignacion(str(token), accion)

    estados_ok = ["aceptada", "rechazada", "expirada", "ya_resuelta"]
    if resultado.get("status") in estados_ok:
        return Response(resultado, status=status.HTTP_200_OK)

    if resultado.get("status") in ["token_invalido", "accion_invalida"]:
        return Response(resultado, status=status.HTTP_400_BAD_REQUEST)

    if resultado.get("status") in [
        "hueco_no_disponible",
        "turno_ofrecido_no_disponible",
    ]:
        return Response(resultado, status=status.HTTP_409_CONFLICT)

    return Response(resultado, status=status.HTTP_400_BAD_REQUEST)
