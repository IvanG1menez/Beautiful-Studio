"""Views para la app de clientes"""

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Cliente
from .serializers import (
    ClienteListSerializer,
    ClienteDetailSerializer,
    ClienteCreateSerializer,
    ClienteUpdateSerializer,
)
from apps.authentication.pagination import CustomPageNumberPagination


class ClienteViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar clientes

    Endpoints:
    - GET /api/clientes/ - Listar todos los clientes
    - GET /api/clientes/:id/ - Obtener un cliente específico
    - POST /api/clientes/ - Crear un nuevo cliente
    - PUT /api/clientes/:id/ - Actualizar un cliente
    - PATCH /api/clientes/:id/ - Actualizar parcialmente un cliente
    - DELETE /api/clientes/:id/ - Eliminar un cliente
    - GET /api/clientes/vip/ - Listar clientes VIP
    - POST /api/clientes/:id/toggle_vip/ - Cambiar estado VIP
    """

    queryset = Cliente.objects.select_related("user").all()
    permission_classes = [IsAuthenticated]
    pagination_class = CustomPageNumberPagination
    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    # Campos para búsqueda
    search_fields = [
        "user__username",
        "user__email",
        "user__first_name",
        "user__last_name",
        "user__dni",
        "user__phone",
        "direccion",
        "preferencias",
    ]

    # Campos para filtrado
    filterset_fields = ["is_vip", "user__is_active"]

    # Campos para ordenamiento
    ordering_fields = [
        "created_at",
        "fecha_primera_visita",
        "user__first_name",
        "user__last_name",
        "fecha_nacimiento",
    ]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        """Retornar el serializer apropiado según la acción"""
        if self.action == "list":
            return ClienteListSerializer
        elif self.action == "create":
            return ClienteCreateSerializer
        elif self.action in ["update", "partial_update"]:
            return ClienteUpdateSerializer
        else:
            return ClienteDetailSerializer

    def destroy(self, request, *args, **kwargs):
        """
        Eliminar un cliente y su usuario asociado
        """
        instance = self.get_object()
        user = instance.user

        # Eliminar el cliente primero
        instance.delete()

        # Luego eliminar el usuario
        if user:
            user.delete()

        return Response(
            {"message": "Cliente eliminado exitosamente"},
            status=status.HTTP_204_NO_CONTENT,
        )

    @action(detail=False, methods=["get"])
    def vip(self, request):
        """
        Listar solo clientes VIP
        """
        queryset = self.filter_queryset(self.get_queryset().filter(is_vip=True))

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post", "patch"])
    def toggle_vip(self, request, pk=None):
        """
        Cambiar el estado VIP de un cliente
        """
        cliente = self.get_object()
        cliente.is_vip = not cliente.is_vip
        cliente.save()

        serializer = self.get_serializer(cliente)
        return Response(
            {
                "message": f'Cliente {"marcado como VIP" if cliente.is_vip else "desmarcado como VIP"}',
                "data": serializer.data,
            }
        )

    @action(detail=True, methods=["get"])
    def historial(self, request, pk=None):
        """
        Obtener el historial de turnos del cliente
        """
        cliente = self.get_object()

        # TEMPORALMENTE COMENTADO - La app de turnos aún no existe
        # # Importar aquí para evitar dependencia circular
        # from apps.turnos.models import Turno
        # from apps.turnos.serializers import TurnoSerializer

        # turnos = Turno.objects.filter(cliente=cliente).order_by("-fecha_hora")
        # serializer = TurnoSerializer(turnos, many=True)

        # return Response(
        #     {
        #         "cliente": self.get_serializer(cliente).data,
        #         "turnos": serializer.data,
        #         "total_turnos": turnos.count(),
        #     }
        # )

        # Respuesta temporal
        return Response(
            {
                "cliente": self.get_serializer(cliente).data,
                "turnos": [],
                "total_turnos": 0,
                "message": "Historial de turnos no disponible - funcionalidad pendiente",
            }
        )

    @action(detail=False, methods=["get"])
    def mis_clientes(self, request):
        """
        Obtener los clientes que han tenido turnos con el profesional autenticado
        """
        from apps.turnos.models import Turno
        from django.db.models import Count, Max, Q
        
        # Verificar que el usuario sea un profesional
        if not hasattr(request.user, 'profesional_profile'):
            return Response(
                {"error": "Usuario no tiene perfil de profesional"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        profesional = request.user.profesional_profile
        
        # Obtener clientes únicos que han tenido turnos con este profesional
        clientes_ids = Turno.objects.filter(
            empleado=profesional
        ).values_list('cliente_id', flat=True).distinct()
        
        # Obtener los clientes con información adicional
        clientes = Cliente.objects.filter(
            id__in=clientes_ids
        ).select_related('user').annotate(
            total_turnos=Count('turnos', filter=Q(turnos__empleado=profesional)),
            ultimo_turno=Max('turnos__fecha_hora', filter=Q(turnos__empleado=profesional)),
            turnos_completados=Count('turnos', filter=Q(
                turnos__empleado=profesional,
                turnos__estado='completado'
            ))
        ).order_by('-ultimo_turno')
        
        # Aplicar paginación
        page = self.paginate_queryset(clientes)
        if page is not None:
            serializer = ClienteListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = ClienteListSerializer(clientes, many=True)
        return Response(serializer.data)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def cliente_me_view(request):
    """
    Vista para obtener y actualizar el perfil del cliente autenticado
    Crea automáticamente un perfil de cliente si no existe
    """
    try:
        cliente = Cliente.objects.select_related("user").get(user=request.user)
    except Cliente.DoesNotExist:
        # Crear automáticamente un perfil de cliente para el usuario
        cliente = Cliente.objects.create(user=request.user, is_vip=False)
        print(f"Perfil de cliente creado automáticamente para: {request.user.username}")

    if request.method == "GET":
        serializer = ClienteDetailSerializer(cliente)
        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method == "PATCH":
        # Permitir actualizar datos del usuario y del cliente
        serializer = ClienteUpdateSerializer(cliente, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            # Retornar con DetailSerializer para incluir datos del user
            detail_serializer = ClienteDetailSerializer(cliente)
            return Response(detail_serializer.data, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
