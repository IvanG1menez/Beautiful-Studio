"""Views para la app de turnos"""

import logging
import uuid
from decimal import Decimal

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from django.db.models import Q
from datetime import datetime, timedelta
from .models import Turno, HistorialTurno, LogReasignacion, SolicitudReprogramacionFlexible
from .serializers import (
    TurnoListSerializer,
    TurnoDetailSerializer,
    TurnoCreateSerializer,
    TurnoUpdateSerializer,
    ReprogramarTurnoSerializer,
    SolicitudReprogramacionFlexibleCreateSerializer,
    SolicitudReprogramacionFlexibleSerializer,
    HistorialTurnoSerializer,
)
from apps.authentication.pagination import CustomPageNumberPagination
from apps.authentication.models import AuditoriaAcciones

from apps.turnos.services.reasignacion_service import (
    responder_oferta_reasignacion,
    obtener_detalles_oferta_reasignacion,
)
from apps.turnos.services.cancelacion_service import cancelar_turno_para_cliente
from apps.turnos.services.reprogramacion_service import (
    reprogramar_turno,
    validar_limite_reprogramacion_cliente_servicio,
)

logger = logging.getLogger(__name__)


def _registrar_auditoria_turno(request, accion: str, turno: Turno, detalles: dict) -> None:
    try:
        AuditoriaAcciones.objects.create(
            usuario=request.user if request.user.is_authenticated else None,
            accion=accion,
            modelo_afectado="Turno",
            objeto_id=turno.id,
            detalles=detalles,
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        )
    except Exception as exc:
        logger.warning("No se pudo registrar auditoria de turno: %s", exc)


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
        "cliente__user", "empleado__user", "servicio__categoria", "sala"
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
    filterset_fields = [
        "estado",
        "empleado",
        "cliente",
        "servicio",
        "canal_reserva",
        "metodo_pago",
        "es_cliente_registrado",
    ]

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
            "reprogramar",
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

    def _get_solicitudes_flexibles_queryset(self):
        user = self.request.user
        queryset = SolicitudReprogramacionFlexible.objects.select_related(
            "turno",
            "cliente",
            "turno__empleado",
            "turno__servicio",
        )

        if hasattr(user, "cliente_profile"):
            queryset = queryset.filter(cliente=user.cliente_profile)
        elif hasattr(user, "profesional_profile"):
            queryset = queryset.filter(turno__empleado=user.profesional_profile)

        return queryset

    def _obtener_o_crear_cliente_desde_datos(self, datos: dict):
        """Obtiene o crea un cliente a partir de los datos básicos.

        Devuelve una tupla (cliente, ya_registrado) donde ``ya_registrado``
        indica si el cliente existía previamente en la base.
        """

        from apps.clientes.models import Cliente
        from apps.users.models import User

        cliente_id = datos.get("cliente_id") or datos.get("cliente")
        if cliente_id:
            try:
                cliente = Cliente.objects.select_related("user").get(pk=cliente_id)
                return cliente, True
            except Cliente.DoesNotExist:
                pass

        dni = (datos.get("dni") or "").strip()
        email = (datos.get("email") or "").strip()

        if dni:
            cliente = (
                Cliente.objects.select_related("user").filter(user__dni=dni).first()
            )
            if cliente:
                return cliente, True

        if email:
            cliente = (
                Cliente.objects.select_related("user").filter(user__email=email).first()
            )
            if cliente:
                return cliente, True

        nombre = (datos.get("nombre") or "").strip() or "Cliente"
        telefono = (datos.get("telefono") or "").strip() or None

        partes_nombre = nombre.split(" ", 1)
        first_name = partes_nombre[0]
        last_name = partes_nombre[1] if len(partes_nombre) > 1 else ""

        username_base = email or (dni and f"cliente-{dni}") or None
        if not username_base:
            username_base = f"cliente-{uuid.uuid4().hex[:8]}"

        user_email = email or f"no-email-{uuid.uuid4().hex[:8]}@example.com"

        user = User.objects.create_user(
            username=username_base,
            email=user_email,
            first_name=first_name,
            last_name=last_name,
        )
        user.role = "cliente"
        user.dni = dni or None
        user.phone = telefono
        user.is_active = False
        user.set_unusable_password()
        user.save()

        cliente = Cliente.objects.create(user=user)
        return cliente, False

    @action(detail=False, methods=["get"], url_path="historial")
    def historial(self, request):
        """
        Obtener turnos del dia para historial.
        Incluye estados: cancelado, confirmado y completado.
        """
        user = request.user

        if not (
            user.is_staff or user.role in ["propietario", "superusuario", "profesional"]
        ):
            return Response(
                {"error": "No tiene permisos para ver el historial"},
                status=status.HTTP_403_FORBIDDEN,
            )

        fecha_hoy = timezone.localdate()
        estados_historial = ["cancelado", "confirmado", "completado"]

        queryset = Turno.objects.select_related(
            "cliente__user", "empleado__user", "servicio__categoria"
        ).filter(fecha_hora__date=fecha_hoy, estado__in=estados_historial)

        if hasattr(user, "profesional_profile"):
            queryset = queryset.filter(empleado=user.profesional_profile)

        queryset = queryset.order_by("-fecha_hora")

        serializer = TurnoListSerializer(queryset, many=True)
        return Response(serializer.data)

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

        if serializer.instance is not None:
            serializer.instance._streak_actor_user = self.request.user
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
        motivo = request.data.get("motivo")

        try:
            resultado = cancelar_turno_para_cliente(
                turno=turno,
                usuario=request.user,
                motivo=motivo,
            )
        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": "Turno cancelado exitosamente",
                "credito_aplicado": resultado.credito_aplicado,
                "monto_credito": resultado.monto_credito,
                "horas_antelacion_requerida": resultado.horas_antelacion_requerida,
            },
            status=status.HTTP_200_OK,
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

    @action(detail=False, methods=["post"], url_path="reservar-staff")
    def reservar_staff(self, request):
        """Crear un turno desde el panel del profesional/propietario.

        Permite reservar un turno en nombre de un cliente existente o crear
        rápidamente un cliente nuevo (walk-in). En esta primera iteración,
        sólo se registra pago directo (efectivo/transferencia); el flujo de
        QR Mercado Pago se orquesta desde la app de Mercado Pago.
        """

        user = request.user
        if not (
            user.is_staff or user.role in ["propietario", "superusuario", "profesional"]
        ):
            return Response(
                {"error": "No tiene permisos para crear turnos desde panel"},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = request.data

        from apps.servicios.models import Servicio
        from apps.empleados.models import Empleado

        try:
            servicio_id = data.get("servicio") or data.get("servicio_id")
            empleado_id = data.get("empleado") or data.get("empleado_id")
            if not servicio_id or not empleado_id:
                return Response(
                    {"error": "Debe indicar servicio y empleado"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Compatibilidad: permitir enviar "me" desde frontend de profesional.
            if str(empleado_id).lower() == "me":
                if hasattr(user, "profesional_profile") and user.profesional_profile:
                    empleado_id = user.profesional_profile.id
                else:
                    return Response(
                        {"error": "El usuario no tiene perfil profesional asociado"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            try:
                empleado_id = int(empleado_id)
            except (TypeError, ValueError):
                return Response(
                    {"error": "empleado debe ser un ID numérico válido"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            servicio = Servicio.objects.get(pk=servicio_id)
            Empleado.objects.get(pk=empleado_id)  # sólo para validar existencia
        except Servicio.DoesNotExist:
            return Response(
                {"error": "Servicio no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Empleado.DoesNotExist:
            return Response(
                {"error": "Profesional no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        metodo_pago = data.get("metodo_pago") or "efectivo"

        metodos_validos = {opcion for opcion, _ in Turno.METODO_PAGO_CHOICES}
        if metodo_pago not in metodos_validos:
            return Response(
                {"error": "Método de pago inválido"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if metodo_pago == "mercadopago_qr":
            return Response(
                {
                    "error": (
                        "El flujo de pago por QR para profesionales se maneja "
                        "a través de las vistas de Mercado Pago y se implementará "
                        "en el siguiente paso del backend."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        cliente_datos = {
            "cliente_id": data.get("cliente") or data.get("cliente_id"),
            "dni": data.get("dni"),
            "email": data.get("email"),
            "nombre": data.get("nombre"),
            "telefono": data.get("telefono"),
        }
        cliente, ya_registrado = self._obtener_o_crear_cliente_desde_datos(
            cliente_datos
        )

        tipo_pago_informado = (data.get("tipo_pago") or "").upper()
        paga_servicio_completo = bool(data.get("paga_servicio_completo", False))

        if tipo_pago_informado not in {"SENIA", "PAGO_COMPLETO", "SIN_PAGO"}:
            tipo_pago_informado = "PAGO_COMPLETO" if paga_servicio_completo else "SENIA"

        try:
            monto_senia_input = Decimal(
                str(data.get("monto_senia") or data.get("senia_pagada") or "0")
            )
        except Exception:
            return Response(
                {"error": "monto_senia inválido"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        precio_servicio = Decimal(str(servicio.precio or 0))
        monto_senia_fijo = Decimal(str(getattr(servicio, "monto_sena_fijo", 0) or 0))
        if monto_senia_fijo <= 0 and precio_servicio > 0:
            monto_senia_fijo = (precio_servicio / Decimal("2")).quantize(
                Decimal("0.01")
            )

        if tipo_pago_informado == "PAGO_COMPLETO":
            senia_pagada = max(Decimal("0"), precio_servicio)
            tipo_pago_final = "PAGO_COMPLETO"
        elif tipo_pago_informado == "SIN_PAGO":
            senia_pagada = Decimal("0.00")
            tipo_pago_final = "SIN_PAGO"
        else:
            senia_pagada = max(Decimal("0"), monto_senia_fijo or monto_senia_input)
            tipo_pago_final = "SENIA"

        # Si el pago cubre el total del servicio, el turno queda confirmado.
        estado_inicial = (
            "confirmado"
            if senia_pagada >= precio_servicio and precio_servicio > 0
            else "pendiente"
        )

        canal_reserva = (
            "panel_profesional" if user.role == "profesional" else "panel_propietario"
        )

        serializer_data = {
            "cliente": cliente.pk,
            "empleado": empleado_id,
            "servicio": servicio_id,
            "fecha_hora": data.get("fecha_hora"),
            "notas_cliente": data.get("notas_cliente") or "",
            "precio_final": str(precio_servicio),
            "senia_pagada": str(senia_pagada),
            "estado": estado_inicial,
            "canal_reserva": canal_reserva,
            "metodo_pago": metodo_pago,
            "tipo_pago": tipo_pago_final,
            "es_cliente_registrado": ya_registrado,
            "walkin_nombre": cliente_datos.get("nombre"),
            "walkin_dni": cliente_datos.get("dni"),
            "walkin_email": cliente_datos.get("email"),
            "walkin_telefono": cliente_datos.get("telefono"),
        }

        serializer = TurnoCreateSerializer(data=serializer_data)
        serializer.is_valid(raise_exception=True)
        turno = serializer.save()

        if senia_pagada > 0 and not turno.fecha_pago_registrado:
            turno.fecha_pago_registrado = timezone.now()
            turno.save(update_fields=["fecha_pago_registrado"])

        HistorialTurno.objects.create(
            turno=turno,
            usuario=request.user,
            accion="Turno creado por staff",
            estado_anterior=None,
            estado_nuevo=turno.estado,
            observaciones=(
                f"Turno creado desde panel por {request.user.full_name}. "
                f"Método de pago: {metodo_pago}."
            ),
        )

        return Response(
            {
                "message": "Turno creado exitosamente desde panel",
                "turno": TurnoDetailSerializer(turno).data,
            },
            status=status.HTTP_201_CREATED,
        )

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

    def _calcular_horarios_disponibles(self, empleado, servicio, fecha_obj):
        from apps.empleados.models import HorarioEmpleado

        dia_semana = fecha_obj.weekday()
        horarios_dia = HorarioEmpleado.objects.filter(
            empleado=empleado, dia_semana=dia_semana, is_active=True
        ).order_by("hora_inicio")

        if not horarios_dia.exists():
            dias_trabajo = empleado.dias_trabajo.split(",")
            dias_map = {"L": 0, "M": 1, "Mi": 2, "J": 3, "V": 4, "S": 5, "D": 6}
            dias_numericos = []
            for dia in dias_trabajo:
                dia = dia.strip()
                if dia == "X":
                    dias_numericos.append(2)
                elif dia in dias_map:
                    dias_numericos.append(dias_map[dia])

            if dia_semana not in dias_numericos:
                return []

            class HorarioLegacy:
                def __init__(self, hora_inicio, hora_fin):
                    self.hora_inicio = hora_inicio
                    self.hora_fin = hora_fin

            horarios_dia = [
                HorarioLegacy(empleado.horario_entrada, empleado.horario_salida)
            ]

        horarios_disponibles = []
        incremento = timedelta(minutes=15)
        turnos_dia = list(
            Turno.objects.select_related("servicio").filter(
                empleado=empleado,
                fecha_hora__date=fecha_obj,
                estado__in=[
                    "pendiente",
                    "confirmado",
                    "en_proceso",
                    "pendiente_manual",
                ],
            )
        )

        for horario_rango in horarios_dia:
            hora_actual = timezone.make_aware(
                datetime.combine(fecha_obj, horario_rango.hora_inicio)
            )
            hora_fin = timezone.make_aware(
                datetime.combine(fecha_obj, horario_rango.hora_fin)
            )

            while hora_actual + timedelta(minutes=servicio.duracion_minutos) <= hora_fin:
                hora_fin_turno = hora_actual + timedelta(
                    minutes=servicio.duracion_minutos
                )
                conflicto = False
                for turno_existente in turnos_dia:
                    if not turno_existente.fecha_hora or not turno_existente.servicio:
                        continue
                    inicio_existente = turno_existente.fecha_hora
                    fin_existente = inicio_existente + timedelta(
                        minutes=turno_existente.servicio.duracion_minutos
                    )
                    if hora_actual < fin_existente and hora_fin_turno > inicio_existente:
                        conflicto = True
                        break

                if not conflicto and hora_actual > timezone.now():
                    hora_str = hora_actual.strftime("%H:%M")
                    if hora_str not in horarios_disponibles:
                        horarios_disponibles.append(hora_str)

                hora_actual += incremento

        return sorted(horarios_disponibles)

    def _buscar_conflicto_sobreturno(self, turno: Turno, fecha_hora_nueva):
        hora_fin_nueva = fecha_hora_nueva + timedelta(
            minutes=turno.servicio.duracion_minutos
        )
        turnos_conflicto = (
            Turno.objects.select_related("cliente", "cliente__user", "servicio")
            .filter(
                empleado=turno.empleado,
                estado__in=["pendiente", "confirmado", "en_proceso"],
            )
            .exclude(pk=turno.pk)
        )

        for turno_existente in turnos_conflicto:
            fin_existente = turno_existente.fecha_hora + timedelta(
                minutes=turno_existente.servicio.duracion_minutos
            )
            if fecha_hora_nueva < fin_existente and hora_fin_nueva > turno_existente.fecha_hora:
                return turno_existente

        return None

    @action(detail=False, methods=["get"])
    def disponibilidad(self, request):
        """Verificar disponibilidad de horarios para un empleado y servicio"""
        empleado_id = (
            request.query_params.get("profesional_id")
            or request.query_params.get("empleado")
            or request.query_params.get("empleado_id")
        )
        servicio_id = request.query_params.get("servicio")
        fecha = request.query_params.get("fecha")  # Formato: YYYY-MM-DD

        if not all([servicio_id, fecha]):
            return Response(
                {"error": "Debe proporcionar servicio y fecha"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from apps.empleados.models import Empleado, EmpleadoServicio, HorarioEmpleado
            from apps.servicios.models import Servicio

            servicio = Servicio.objects.get(id=servicio_id)
            fecha_obj = datetime.strptime(fecha, "%Y-%m-%d").date()
            empleado_id_normalizado = str(empleado_id or "").strip().lower()
            buscar_todos = empleado_id_normalizado in ["", "null", "none", "todos", "all"]

            if buscar_todos:
                empleados = Empleado.objects.filter(
                    id__in=EmpleadoServicio.objects.filter(servicio=servicio).values(
                        "empleado_id"
                    ),
                    is_disponible=True,
                ).select_related("user")
                slots_por_hora = {}
                profesionales = []

                for empleado in empleados:
                    horarios = self._calcular_horarios_disponibles(
                        empleado, servicio, fecha_obj
                    )
                    if not horarios:
                        continue
                    profesionales.append(
                        {"id": empleado.id, "nombre": empleado.nombre_completo}
                    )
                    for hora in horarios:
                        slots_por_hora.setdefault(hora, []).append(str(empleado.id))

                slots = [
                    {
                        "time": hora,
                        "professionalIds": professional_ids,
                        "available": bool(professional_ids),
                    }
                    for hora, professional_ids in sorted(slots_por_hora.items())
                ]

                return Response(
                    {
                        "disponible": len(slots) > 0,
                        "empleado": None,
                        "servicio": servicio.nombre,
                        "fecha": fecha,
                        "horarios": [slot["time"] for slot in slots],
                        "slots": slots,
                        "profesionales": profesionales,
                    }
                )

            empleado = Empleado.objects.get(id=empleado_id)

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
            # La UI del panel profesional trabaja en bloques de 15 minutos.
            incremento = timedelta(minutes=15)

            # Obtener turnos existentes del empleado en ese día para chequear solapamientos
            turnos_dia = list(
                Turno.objects.select_related("servicio").filter(
                    empleado=empleado,
                    fecha_hora__date=fecha_obj,
                    estado__in=["pendiente", "confirmado", "en_proceso", "pendiente_manual"],
                )
            )

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
                    # Verificar si hay turno en ese horario considerando duración completa
                    hora_fin_turno = hora_actual + timedelta(
                        minutes=servicio.duracion_minutos
                    )

                    conflicto = False
                    for turno_existente in turnos_dia:
                        if (
                            not turno_existente.fecha_hora
                            or not turno_existente.servicio
                        ):
                            continue
                        inicio_existente = turno_existente.fecha_hora
                        fin_existente = inicio_existente + timedelta(
                            minutes=turno_existente.servicio.duracion_minutos
                        )
                        # Hay solapamiento si el inicio propuesto es antes del fin existente
                        # y el fin propuesto es después del inicio existente
                        if (
                            hora_actual < fin_existente
                            and hora_fin_turno > inicio_existente
                        ):
                            conflicto = True
                            break

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
                    "slots": [
                        {
                            "time": hora,
                            "professionalIds": [str(empleado.id)],
                            "available": True,
                        }
                        for hora in sorted(horarios_disponibles)
                    ],
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

    @action(detail=True, methods=["post"], url_path="registrar-pago")
    def registrar_pago(self, request, pk=None):
        """Registrar manualmente un pago asociado a un turno.

        Pensado para pagos en efectivo/transferencia registrados desde el
        panel del propietario o profesional.
        """

        user = request.user
        if not (
            user.is_staff or user.role in ["propietario", "superusuario", "profesional"]
        ):
            return Response(
                {"error": "No tiene permisos para registrar pagos"},
                status=status.HTTP_403_FORBIDDEN,
            )

        turno = self.get_object()

        metodo_pago = (
            request.data.get("metodo_pago")
            or request.data.get("tipo_pago")
            or "efectivo"
        )

        metodos_validos = {opcion for opcion, _ in Turno.METODO_PAGO_CHOICES}
        if metodo_pago not in metodos_validos:
            return Response(
                {"error": "Método de pago inválido"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            monto = Decimal(str(request.data.get("monto") or "0"))
        except Exception:
            return Response(
                {"error": "Monto inválido"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if monto <= 0:
            return Response(
                {"error": "El monto debe ser mayor a cero"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        estado_anterior = turno.estado

        senia_actual = Decimal(str(turno.senia_pagada or "0"))
        turno.senia_pagada = senia_actual + monto

        precio_final_override = request.data.get("precio_final")
        if precio_final_override is not None:
            try:
                turno.precio_final = Decimal(str(precio_final_override))
            except Exception:
                pass

        if not turno.canal_reserva:
            turno.canal_reserva = (
                "panel_profesional"
                if user.role == "profesional"
                else "panel_propietario"
            )

        turno.metodo_pago = metodo_pago
        turno.fecha_pago_registrado = timezone.now()
        turno.save()

        HistorialTurno.objects.create(
            turno=turno,
            usuario=user,
            accion="Pago registrado manualmente",
            estado_anterior=estado_anterior,
            estado_nuevo=turno.estado,
            observaciones=(
                f"Pago {metodo_pago} registrado por {user.full_name}. "
                f"Monto: {monto}."
            ),
        )

        return Response(TurnoDetailSerializer(turno).data)

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
        turno._streak_actor_user = request.user

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

    @action(detail=True, methods=["post"], url_path="reprogramar")
    def reprogramar(self, request, pk=None):
        """Reprogramar un turno confirmado manteniendo pagos y datos comerciales."""
        turno = self.get_object()
        user = request.user

        es_admin = user.is_staff or user.role in ["propietario", "superusuario"]
        es_cliente_duenio = hasattr(user, "cliente_profile") and (
            turno.cliente_id == user.cliente_profile.id
        )
        es_profesional_asignado = hasattr(user, "profesional_profile") and (
            turno.empleado_id == user.profesional_profile.id
        )

        if not (es_admin or es_cliente_duenio or es_profesional_asignado):
            return Response(
                {"error": "No tiene permisos para reprogramar este turno."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ReprogramarTurnoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            resultado = reprogramar_turno(
                turno=turno,
                usuario=user,
                fecha_hora_nueva=serializer.validated_data["nueva_fecha_hora"],
                nuevo_empleado_id=serializer.validated_data.get("nuevo_empleado_id"),
                aceptar_penalidad_fuera_rango=serializer.validated_data.get(
                    "aceptar_penalidad_fuera_rango", False
                ),
                motivo=serializer.validated_data.get("motivo", ""),
                permitir_sobreturno=serializer.validated_data.get(
                    "permitir_sobreturno", False
                ),
            )
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        _registrar_auditoria_turno(
            request,
            "editar",
            resultado.turno,
            {
                "tipo_movimiento": "reprogramacion_turno",
                "fecha_hora_anterior": resultado.fecha_hora_anterior.isoformat(),
                "fecha_hora_nueva": resultado.fecha_hora_nueva.isoformat(),
                "sena_reiniciada": resultado.sena_reiniciada,
                "penalidad_aplicada": resultado.penalidad_aplicada,
                "estado_pago_reprogramacion": (
                    "SENIA_PENDIENTE_LOCAL"
                    if resultado.penalidad_aplicada
                    else "SIN_PENALIDAD"
                ),
                "brecha_horas": resultado.brecha_horas,
                "mensaje_penalidad_cliente": resultado.mensaje_penalidad,
                "motivo": serializer.validated_data.get("motivo", ""),
                "nuevo_empleado_id": serializer.validated_data.get("nuevo_empleado_id"),
            },
        )

        return Response(
            {
                "message": "Turno reprogramado exitosamente",
                "fecha_hora_anterior": resultado.fecha_hora_anterior,
                "fecha_hora_nueva": resultado.fecha_hora_nueva,
                "sena_reiniciada": resultado.sena_reiniciada,
                "penalidad_aplicada": resultado.penalidad_aplicada,
                "estado_pago_reprogramacion": (
                    "SENIA_PENDIENTE_LOCAL"
                    if resultado.penalidad_aplicada
                    else "SIN_PENALIDAD"
                ),
                "brecha_horas": resultado.brecha_horas,
                "mensaje_penalidad": resultado.mensaje_penalidad,
                "turno": TurnoDetailSerializer(resultado.turno).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="solicitar-reprogramacion-flexible")
    def solicitar_reprogramacion_flexible(self, request, pk=None):
        """Crear una solicitud flexible para revisión manual del estudio."""
        turno = self.get_object()
        user = request.user

        es_admin = user.is_staff or user.role in ["propietario", "superusuario"]
        es_cliente_duenio = hasattr(user, "cliente_profile") and (
            turno.cliente_id == user.cliente_profile.id
        )
        es_profesional_asignado = hasattr(user, "profesional_profile") and (
            turno.empleado_id == user.profesional_profile.id
        )

        if not (es_admin or es_cliente_duenio or es_profesional_asignado):
            return Response(
                {"error": "No tiene permisos para solicitar esta reprogramación."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = SolicitudReprogramacionFlexibleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from .models import SolicitudReprogramacionFlexible

        try:
            validar_limite_reprogramacion_cliente_servicio(turno)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        ahora = timezone.now()
        fuera_de_termino = not (
            ahora <= turno.fecha_hora - timedelta(hours=24)
        )
        from apps.authentication.models import ConfiguracionGlobal

        config_global = ConfiguracionGlobal.get_config()
        horas_vencimiento = max(
            1,
            int(config_global.horas_vencimiento_solicitud_reprogramacion or 48),
        )

        solicitud = SolicitudReprogramacionFlexible.objects.create(
            turno=turno,
            cliente=turno.cliente,
            motivo=serializer.validated_data.get("motivo", ""),
            preferencia_fecha=serializer.validated_data.get("preferencia_fecha"),
            preferencia_horario=serializer.validated_data.get("preferencia_horario", ""),
            requiere_senia_nueva=fuera_de_termino,
            expires_at=ahora + timedelta(hours=horas_vencimiento),
        )

        estado_anterior = turno.estado
        turno.estado = "pendiente_manual"
        update_fields = ["estado", "updated_at"]
        if fuera_de_termino:
            turno.senia_pagada = Decimal("0.00")
            turno.tipo_pago = "SIN_PAGO"
            turno.metodo_pago = None
            turno.fecha_pago_registrado = None
            update_fields.extend(
                [
                    "senia_pagada",
                    "tipo_pago",
                    "metodo_pago",
                    "fecha_pago_registrado",
                ]
            )
        turno.save(update_fields=update_fields)

        HistorialTurno.objects.create(
            turno=turno,
            usuario=request.user,
            accion="Solicitud reprogramacion flexible",
            estado_anterior=estado_anterior,
            estado_nuevo=turno.estado,
            observaciones=(
                f"Solicitud flexible creada por {request.user.full_name}. "
                f"Motivo: {solicitud.motivo or 'Sin motivo'}. "
                f"Seña: {'perdida por multa aplicada' if fuera_de_termino else 'vigente'}."
            ),
        )

        _registrar_auditoria_turno(
            request,
            "crear",
            turno,
            {
                "tipo_movimiento": "solicitud_reprogramacion_flexible",
                "solicitud_id": solicitud.id,
                "cliente_id": turno.cliente_id,
                "empleado_id": turno.empleado_id,
                "servicio_id": turno.servicio_id,
                "estado_anterior": estado_anterior,
                "estado_nuevo": turno.estado,
                "senia_perdida": fuera_de_termino,
                "motivo": solicitud.motivo,
                "preferencia_fecha": (
                    solicitud.preferencia_fecha.isoformat()
                    if solicitud.preferencia_fecha
                    else None
                ),
                "preferencia_horario": solicitud.preferencia_horario,
            },
        )

        return Response(
            {
                "message": "Solicitud flexible creada exitosamente",
                "solicitud": SolicitudReprogramacionFlexibleSerializer(solicitud).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="solicitudes-flexibles")
    def listar_solicitudes_flexibles(self, request):
        """Listar solicitudes flexibles para revisión manual."""
        user = request.user

        if not (
            user.is_staff
            or user.role in ["propietario", "superusuario", "profesional"]
            or hasattr(user, "cliente_profile")
        ):
            return Response(
                {"error": "No tiene permisos para ver las solicitudes."},
                status=status.HTTP_403_FORBIDDEN,
            )

        queryset = self._get_solicitudes_flexibles_queryset()
        estado = request.query_params.get("estado")
        if estado == "procesadas":
            queryset = queryset.filter(estado__in=["atendida", "rechazada"])
        elif estado == "vencidas":
            queryset = queryset.filter(
                estado__in=["pendiente", "en_revision"],
                expires_at__lt=timezone.now(),
            )
        elif estado:
            queryset = queryset.filter(estado=estado)

        queryset = queryset.order_by("-created_at")
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = SolicitudReprogramacionFlexibleSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = SolicitudReprogramacionFlexibleSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="solicitudes-flexibles/resumen")
    def resumen_solicitudes_flexibles(self, request):
        """Obtener resumen de solicitudes flexibles por estado."""
        queryset = self._get_solicitudes_flexibles_queryset()

        pendientes = queryset.filter(estado="pendiente").count()
        atendidas = queryset.filter(estado="atendida").count()
        rechazadas = queryset.filter(estado="rechazada").count()
        en_revision = queryset.filter(estado="en_revision").count()
        vencidas = queryset.filter(
            estado__in=["pendiente", "en_revision"],
            expires_at__lt=timezone.now(),
        ).count()

        return Response(
            {
                "pendientes": pendientes,
                "atendidas": atendidas,
                "rechazadas": rechazadas,
                "en_revision": en_revision,
                "vencidas": vencidas,
                "total": pendientes + atendidas + rechazadas + en_revision,
            }
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="solicitudes-flexibles/(?P<solicitud_id>[^/.]+)/asignar",
    )
    def asignar_solicitud_flexible(self, request, solicitud_id=None):
        """Asignar manualmente un turno para una solicitud flexible."""
        user = request.user

        try:
            solicitud = SolicitudReprogramacionFlexible.objects.select_related(
                "turno", "turno__empleado"
            ).get(pk=solicitud_id)
        except SolicitudReprogramacionFlexible.DoesNotExist:
            return Response(
                {"error": "Solicitud no encontrada"},
                status=status.HTTP_404_NOT_FOUND,
            )

        es_admin = user.is_staff or user.role in ["propietario", "superusuario"]
        es_profesional_asignado = hasattr(user, "profesional_profile") and (
            solicitud.turno.empleado_id == user.profesional_profile.id
        )

        if not (es_admin or es_profesional_asignado):
            return Response(
                {"error": "No tiene permisos para atender esta solicitud."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if solicitud.estado not in ["pendiente", "en_revision"]:
            return Response(
                {"error": "La solicitud ya fue procesada."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fecha_hora_raw = request.data.get("fecha_hora") or request.data.get("nueva_fecha_hora")
        if not fecha_hora_raw:
            return Response(
                {"error": "Debe indicar fecha_hora para asignar el turno."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        observaciones = request.data.get("observaciones")
        aceptar_penalidad = bool(request.data.get("aceptar_penalidad_fuera_rango", True))
        permitir_sobreturno = bool(request.data.get("permitir_sobreturno", False))

        serializer = ReprogramarTurnoSerializer(
            data={
                "nueva_fecha_hora": fecha_hora_raw,
                "motivo": request.data.get("motivo") or solicitud.motivo or "",
                "aceptar_penalidad_fuera_rango": aceptar_penalidad,
            }
        )
        serializer.is_valid(raise_exception=True)
        fecha_hora = serializer.validated_data["nueva_fecha_hora"]
        motivo = serializer.validated_data.get("motivo") or ""

        conflicto = self._buscar_conflicto_sobreturno(solicitud.turno, fecha_hora)
        if conflicto and not permitir_sobreturno:
            return Response(
                {
                    "error": (
                        f"Este horario ya esta reservado por {conflicto.cliente.nombre_completo}."
                    ),
                    "requiere_confirmacion_sobreturno": True,
                    "conflicto": {
                        "turno_id": conflicto.id,
                        "cliente_nombre": conflicto.cliente.nombre_completo,
                        "servicio_nombre": conflicto.servicio.nombre,
                        "fecha_hora": conflicto.fecha_hora,
                    },
                },
                status=status.HTTP_409_CONFLICT,
            )

        try:
            resultado = reprogramar_turno(
                turno=solicitud.turno,
                usuario=user,
                fecha_hora_nueva=fecha_hora,
                motivo=motivo,
                aceptar_penalidad_fuera_rango=aceptar_penalidad,
                reiniciar_pago_cliente=True,
                permitir_sobreturno=permitir_sobreturno,
            )
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        solicitud.estado = "atendida"
        solicitud.requiere_senia_nueva = resultado.sena_reiniciada
        if observaciones:
            solicitud.observaciones = observaciones
        solicitud.save(
            update_fields=[
                "estado",
                "requiere_senia_nueva",
                "observaciones",
                "updated_at",
            ]
        )

        HistorialTurno.objects.create(
            turno=solicitud.turno,
            usuario=request.user,
            accion="Solicitud flexible atendida",
            estado_anterior=solicitud.turno.estado,
            estado_nuevo=solicitud.turno.estado,
            observaciones=(
                f"Solicitud flexible atendida por {request.user.full_name}. "
                f"Observaciones: {observaciones or 'Sin observaciones'}"
            ),
        )

        try:
            from apps.emails.models import Notificacion

            Notificacion.objects.create(
                usuario=solicitud.turno.cliente.user,
                tipo="modificacion_turno",
                titulo="Tu profesional ya te asignó un nuevo horario",
                mensaje=(
                    "Tu profesional ya te asignó un nuevo horario: "
                    f"{resultado.fecha_hora_nueva.strftime('%d/%m/%Y %H:%M')} hs."
                ),
                data={
                    "turno_id": solicitud.turno.id,
                    "solicitud_id": solicitud.id,
                    "fecha_hora_nueva": resultado.fecha_hora_nueva.isoformat(),
                },
            )
        except Exception as exc:
            logger.warning("No se pudo crear notificacion de asignacion flexible: %s", exc)

        _registrar_auditoria_turno(
            request,
            "editar",
            solicitud.turno,
            {
                "tipo_movimiento": "solicitud_reprogramacion_flexible_atendida",
                "solicitud_id": solicitud.id,
                "fecha_hora_anterior": resultado.fecha_hora_anterior.isoformat(),
                "fecha_hora_nueva": resultado.fecha_hora_nueva.isoformat(),
                "empleado_id": solicitud.turno.empleado_id,
                "sena_reiniciada": resultado.sena_reiniciada,
                "penalidad_aplicada": resultado.penalidad_aplicada,
                "mensaje_penalidad_cliente": resultado.mensaje_penalidad,
                "sobreturno_autorizado": permitir_sobreturno,
                "conflicto_turno_id": conflicto.id if conflicto else None,
                "observaciones": observaciones or "",
                "motivo": motivo,
            },
        )

        return Response(
            {
                "message": "Solicitud atendida y turno reprogramado",
                "solicitud": SolicitudReprogramacionFlexibleSerializer(solicitud).data,
                "turno": TurnoDetailSerializer(resultado.turno).data,
                "fecha_hora_anterior": resultado.fecha_hora_anterior,
                "fecha_hora_nueva": resultado.fecha_hora_nueva,
                "sena_reiniciada": resultado.sena_reiniciada,
                "penalidad_aplicada": resultado.penalidad_aplicada,
                "mensaje_penalidad": resultado.mensaje_penalidad,
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="solicitudes-flexibles/(?P<solicitud_id>[^/.]+)/rechazar",
    )
    def rechazar_solicitud_flexible(self, request, solicitud_id=None):
        """Rechazar una solicitud flexible."""
        user = request.user

        try:
            solicitud = SolicitudReprogramacionFlexible.objects.select_related(
                "turno", "turno__empleado"
            ).get(pk=solicitud_id)
        except SolicitudReprogramacionFlexible.DoesNotExist:
            return Response(
                {"error": "Solicitud no encontrada"},
                status=status.HTTP_404_NOT_FOUND,
            )

        es_admin = user.is_staff or user.role in ["propietario", "superusuario"]
        es_profesional_asignado = hasattr(user, "profesional_profile") and (
            solicitud.turno.empleado_id == user.profesional_profile.id
        )

        if not (es_admin or es_profesional_asignado):
            return Response(
                {"error": "No tiene permisos para rechazar esta solicitud."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if solicitud.estado not in ["pendiente", "en_revision"]:
            return Response(
                {"error": "La solicitud ya fue procesada."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "error": "Las solicitudes flexibles no se rechazan. Deben asignarse manualmente o quedar vencidas para revisión del propietario."
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="solicitudes-flexibles/(?P<solicitud_id>[^/.]+)/registrar-explicacion",
    )
    def registrar_explicacion_solicitud_flexible(self, request, solicitud_id=None):
        """Registrar explicación operativa para una solicitud flexible vencida."""
        user = request.user

        try:
            solicitud = SolicitudReprogramacionFlexible.objects.select_related(
                "turno", "turno__empleado"
            ).get(pk=solicitud_id)
        except SolicitudReprogramacionFlexible.DoesNotExist:
            return Response(
                {"error": "Solicitud no encontrada"},
                status=status.HTTP_404_NOT_FOUND,
            )

        es_admin = user.is_staff or user.role in ["propietario", "superusuario"]
        es_profesional_asignado = hasattr(user, "profesional_profile") and (
            solicitud.turno.empleado_id == user.profesional_profile.id
        )

        if not (es_admin or es_profesional_asignado):
            return Response(
                {"error": "No tiene permisos para explicar esta solicitud."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not solicitud.esta_vencida:
            return Response(
                {"error": "Solo se puede registrar explicación en solicitudes vencidas."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        explicacion = (request.data.get("explicacion") or "").strip()
        if not explicacion:
            return Response(
                {"error": "Debe indicar una explicación."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        solicitud.explicacion_vencimiento = explicacion
        solicitud.save(update_fields=["explicacion_vencimiento", "updated_at"])

        HistorialTurno.objects.create(
            turno=solicitud.turno,
            usuario=request.user,
            accion="Explicacion solicitud flexible vencida",
            estado_anterior=solicitud.turno.estado,
            estado_nuevo=solicitud.turno.estado,
            observaciones=explicacion,
        )

        _registrar_auditoria_turno(
            request,
            "editar",
            solicitud.turno,
            {
                "tipo_movimiento": "solicitud_reprogramacion_flexible_vencida_explicada",
                "solicitud_id": solicitud.id,
                "cliente_id": solicitud.cliente_id,
                "empleado_id": solicitud.turno.empleado_id,
                "explicacion": explicacion,
            },
        )

        return Response(
            {
                "message": "Explicación registrada",
                "solicitud": SolicitudReprogramacionFlexibleSerializer(solicitud).data,
            },
            status=status.HTTP_200_OK,
        )

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
        from django.db.models import Sum

        # Verificar que sea propietario o admin
        if request.user.role not in ["propietario", "superusuario"]:
            return Response(
                {"error": "No tiene permisos para ver estas métricas"},
                status=status.HTTP_403_FORBIDDEN,
            )

        now = timezone.now()
        today = now.date()
        yesterday = today - timedelta(days=1)
        start_of_month = today.replace(day=1)
        end_prev_month = start_of_month - timedelta(days=1)
        start_prev_month = end_prev_month.replace(day=1)
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

        ingresos_mes_prev = (
            Turno.objects.filter(
                estado="completado",
                fecha_hora__date__gte=start_prev_month,
                fecha_hora__date__lte=end_prev_month,
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

        comision_pendiente_prev = (
            Turno.objects.filter(
                estado="completado",
                fecha_hora__date__gte=start_prev_month,
                fecha_hora__date__lte=end_prev_month,
            ).aggregate(total=Sum("precio_final"))["total"]
            or 0
        )

        # Aplicar % de comisión (por ejemplo 30%)
        porcentaje_comision = 0.30
        comision_pendiente = float(comision_pendiente) * porcentaje_comision
        comision_pendiente_prev = float(comision_pendiente_prev) * porcentaje_comision

        # Turnos pendientes de pago (completados)
        turnos_pendientes_pago = Turno.objects.filter(
            estado="completado",
            # Agregar filtro de pagado=False cuando exista el campo
        ).count()

        turnos_pendientes_pago_prev = Turno.objects.filter(
            estado="completado",
            fecha_hora__date=yesterday,
        ).count()

        # Turnos pendientes de aceptación
        turnos_pendientes_aceptacion = Turno.objects.filter(estado="pendiente").count()

        # Turnos en las próximas 48 horas
        turnos_proximos_48h = (
            Turno.objects.filter(fecha_hora__gte=now, fecha_hora__lte=proximas_48h)
            .exclude(estado__in=["cancelado", "no_asistio"])
            .count()
        )

        turnos_hoy_prev = (
            Turno.objects.filter(fecha_hora__date=yesterday)
            .exclude(estado="cancelado")
            .count()
        )

        def variacion_porcentual(actual, anterior):
            if anterior in [0, None]:
                return 0.0 if actual in [0, None] else 100.0
            return float(((actual - anterior) / anterior) * 100)

        dinero_recuperado = 0
        logs_reacomodados = LogReasignacion.objects.filter(
            estado_final="aceptada", fecha_envio__date__gte=start_of_month
        ).select_related("turno_cancelado__servicio")

        for log in logs_reacomodados:
            turno_cancelado = log.turno_cancelado
            if not turno_cancelado:
                continue
            precio_turno = turno_cancelado.precio_final or (
                turno_cancelado.servicio.precio if turno_cancelado.servicio else 0
            )
            dinero_recuperado += float(precio_turno or 0)

        dinero_recuperado_prev = 0
        logs_reacomodados_prev = LogReasignacion.objects.filter(
            estado_final="aceptada",
            fecha_envio__date__gte=start_prev_month,
            fecha_envio__date__lte=end_prev_month,
        ).select_related("turno_cancelado__servicio")

        for log in logs_reacomodados_prev:
            turno_cancelado = log.turno_cancelado
            if not turno_cancelado:
                continue
            precio_turno = turno_cancelado.precio_final or (
                turno_cancelado.servicio.precio if turno_cancelado.servicio else 0
            )
            dinero_recuperado_prev += float(precio_turno or 0)

        return Response(
            {
                "total_clientes": total_clientes,
                "total_empleados": total_empleados,
                "turnos_hoy": turnos_hoy,
                "turnos_completados_hoy": turnos_completados_hoy,
                "ingresos_mes": float(ingresos_mes),
                "ingresos_mes_variacion": variacion_porcentual(
                    float(ingresos_mes), float(ingresos_mes_prev)
                ),
                "comision_pendiente": comision_pendiente,
                "comision_pendiente_variacion": variacion_porcentual(
                    comision_pendiente, comision_pendiente_prev
                ),
                "turnos_pendientes_pago": turnos_pendientes_pago,
                "turnos_pendientes_pago_variacion": variacion_porcentual(
                    turnos_pendientes_pago, turnos_pendientes_pago_prev
                ),
                "turnos_pendientes_aceptacion": turnos_pendientes_aceptacion,
                "turnos_proximos_48h": turnos_proximos_48h,
                "turnos_hoy_variacion": variacion_porcentual(
                    turnos_hoy, turnos_hoy_prev
                ),
                "dinero_recuperado": float(dinero_recuperado),
                "dinero_recuperado_variacion": variacion_porcentual(
                    float(dinero_recuperado), float(dinero_recuperado_prev)
                ),
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

    @action(detail=False, methods=["get", "post"], url_path="datos-prueba-completar")
    def datos_prueba_completar(self, request):
        """Activa o desactiva datos de prueba para completar turnos del profesional actual."""
        user = request.user

        if not hasattr(user, "profesional_profile"):
            return Response(
                {"error": "Solo los profesionales pueden gestionar datos de prueba"},
                status=status.HTTP_403_FORBIDDEN,
            )

        empleado = user.profesional_profile

        from Scripts.completar_turnos import (
            contar_turnos_prueba_para_empleado,
            eliminar_turnos_prueba_para_empleado,
            seed_turnos_prueba_para_empleado,
        )

        if request.method == "GET":
            cantidad = contar_turnos_prueba_para_empleado(empleado)
            return Response(
                {
                    "success": True,
                    "activo": cantidad > 0,
                    "turnos_prueba": cantidad,
                }
            )

        activo = bool(request.data.get("activo", False))

        if activo:
            cantidad = int(request.data.get("cantidad", 18) or 18)
            dias = int(request.data.get("dias", 30) or 30)

            resultado = seed_turnos_prueba_para_empleado(
                empleado=empleado,
                cantidad=max(1, cantidad),
                dias=max(1, dias),
                limpiar_previos=True,
            )

            return Response(
                {
                    "success": True,
                    "activo": True,
                    "mensaje": "Datos de prueba activados",
                    **resultado,
                }
            )

        eliminados = eliminar_turnos_prueba_para_empleado(empleado)
        return Response(
            {
                "success": True,
                "activo": False,
                "mensaje": "Datos de prueba desactivados",
                "eliminados": eliminados,
                "turnos_prueba": 0,
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
    """
    GET: Obtiene los detalles de una oferta de reasignación
    POST: Acepta o rechaza una oferta de reasignación
    """

    try:
        # GET: Obtener detalles de la oferta
        if request.method == "GET":
            resultado = obtener_detalles_oferta_reasignacion(str(token))

            if resultado.get("status") == "activa":
                return Response(resultado, status=status.HTTP_200_OK)

            if resultado.get("status") in ["ya_resuelta", "expirada"]:
                return Response(resultado, status=status.HTTP_410_GONE)

            if resultado.get("status") == "token_invalido":
                return Response(resultado, status=status.HTTP_404_NOT_FOUND)

            return Response(resultado, status=status.HTTP_400_BAD_REQUEST)

        # POST: Procesar acción (aceptar/rechazar)
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
    except Exception as e:
        logger.exception("Error en responder_reasignacion token=%s", token)
        return Response(
            {
                "status": "error_interno",
                "error": "Error interno procesando la oferta",
                "detalle": str(e),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
