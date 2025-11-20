"""Views para la app de encuestas"""

from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Avg, Count, Q
from django.utils import timezone
from datetime import timedelta

from .models import Encuesta, EncuestaConfig, EncuestaPregunta, RespuestaCliente
from .serializers import (
    EncuestaCreateSerializer,
    EncuestaListSerializer,
    EncuestaDetailSerializer,
    EncuestaConfigSerializer,
    EncuestaPreguntaSerializer,
    EncuestaRespuestaSerializer,
)
from apps.turnos.models import Turno
from apps.authentication.pagination import CustomPageNumberPagination


class EncuestaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar encuestas de satisfacción
    
    Endpoints:
    - GET /api/encuestas/ - Listar encuestas
    - POST /api/encuestas/ - Crear nueva encuesta (responder)
    - GET /api/encuestas/:id/ - Ver detalle de encuesta
    - GET /api/encuestas/mis_encuestas/ - Encuestas del usuario (cliente o empleado)
    - GET /api/encuestas/estadisticas_empleado/:empleado_id/ - Estadísticas de un empleado
    """
    
    queryset = Encuesta.objects.select_related(
        'cliente__user',
        'empleado__user',
        'turno__servicio'
    ).all()
    permission_classes = [IsAuthenticated]
    pagination_class = CustomPageNumberPagination
    
    def get_permissions(self):
        """Permitir acceso público para crear encuestas (POST)"""
        if self.action == 'create':
            return [AllowAny()]
        return super().get_permissions()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return EncuestaCreateSerializer
        elif self.action in ['retrieve', 'estadisticas_empleado']:
            return EncuestaDetailSerializer
        return EncuestaListSerializer
    
    def get_queryset(self):
        """Filtrar queryset según el rol del usuario"""
        user = self.request.user
        queryset = super().get_queryset()
        
        # Propietarios y superusuarios ven todas
        if user.role in ['propietario', 'superusuario']:
            return queryset
        
        # Profesionales ven solo sus encuestas
        if user.role == 'profesional' and hasattr(user, 'profesional_profile'):
            return queryset.filter(empleado=user.profesional_profile)
        
        # Clientes ven solo sus encuestas
        if user.role == 'cliente' and hasattr(user, 'cliente_profile'):
            return queryset.filter(cliente=user.cliente_profile)
        
        return queryset.none()
    
    @action(detail=False, methods=['get'])
    def mis_encuestas(self, request):
        """Obtener encuestas del usuario actual"""
        user = request.user
        
        if user.role == 'profesional' and hasattr(user, 'profesional_profile'):
            encuestas = Encuesta.objects.filter(
                empleado=user.profesional_profile
            ).select_related('cliente__user', 'turno__servicio')
        elif user.role == 'cliente' and hasattr(user, 'cliente_profile'):
            encuestas = Encuesta.objects.filter(
                cliente=user.cliente_profile
            ).select_related('empleado__user', 'turno__servicio')
        else:
            return Response(
                {"error": "No tiene encuestas asociadas"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        page = self.paginate_queryset(encuestas)
        if page is not None:
            serializer = EncuestaListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = EncuestaListSerializer(encuestas, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='estadisticas-empleado/(?P<empleado_id>[^/.]+)')
    def estadisticas_empleado(self, request, empleado_id=None):
        """
        Obtener estadísticas detalladas de encuestas de un empleado
        
        Retorna:
        - Promedio general
        - Total de encuestas
        - Distribución por clasificación (N, Ne, P)
        - Tendencia (últimos 30 días)
        - Últimas encuestas negativas
        """
        from apps.empleados.models import Empleado
        
        try:
            empleado = Empleado.objects.get(id=empleado_id)
        except Empleado.DoesNotExist:
            return Response(
                {"error": "Empleado no encontrado"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verificar permisos
        user = request.user
        if user.role == 'profesional' and hasattr(user, 'profesional_profile'):
            if user.profesional_profile.id != empleado.id:
                return Response(
                    {"error": "No tiene permisos para ver estas estadísticas"},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif user.role not in ['propietario', 'superusuario']:
            return Response(
                {"error": "No tiene permisos para ver estas estadísticas"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Obtener todas las encuestas del empleado
        encuestas = Encuesta.objects.filter(empleado=empleado)
        
        # Estadísticas generales
        total_encuestas = encuestas.count()
        promedio_general = encuestas.aggregate(promedio=Avg('puntaje'))['promedio'] or 0
        
        # Distribución por clasificación
        distribucion = encuestas.values('clasificacion').annotate(
            total=Count('id')
        ).order_by('clasificacion')
        
        distribucion_dict = {
            'negativas': 0,
            'neutrales': 0,
            'positivas': 0,
        }
        
        for item in distribucion:
            if item['clasificacion'] == 'N':
                distribucion_dict['negativas'] = item['total']
            elif item['clasificacion'] == 'Ne':
                distribucion_dict['neutrales'] = item['total']
            elif item['clasificacion'] == 'P':
                distribucion_dict['positivas'] = item['total']
        
        # Tendencia últimos 30 días
        fecha_limite = timezone.now() - timedelta(days=30)
        encuestas_recientes = encuestas.filter(fecha_respuesta__gte=fecha_limite)
        total_recientes = encuestas_recientes.count()
        promedio_reciente = encuestas_recientes.aggregate(promedio=Avg('puntaje'))['promedio'] or 0
        negativas_recientes = encuestas_recientes.filter(clasificacion='N').count()
        
        # Últimas encuestas negativas
        ultimas_negativas = encuestas.filter(
            clasificacion='N'
        ).order_by('-fecha_respuesta')[:5]
        
        ultimas_negativas_data = EncuestaListSerializer(ultimas_negativas, many=True).data
        
        return Response({
            'empleado': {
                'id': empleado.id,
                'nombre_completo': empleado.nombre_completo,
                'especialidad': empleado.get_especialidades_display(),
                'promedio_calificacion': float(empleado.promedio_calificacion),
                'total_encuestas': empleado.total_encuestas,
            },
            'estadisticas': {
                'total_encuestas': total_encuestas,
                'promedio_general': round(float(promedio_general), 2),
                'distribucion': distribucion_dict,
                'tendencia_30_dias': {
                    'total': total_recientes,
                    'promedio': round(float(promedio_reciente), 2),
                    'negativas': negativas_recientes,
                },
                'ultimas_negativas': ultimas_negativas_data,
            }
        })


class EncuestaConfigViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la configuración de encuestas
    - Lectura: Todos los usuarios autenticados
    - Escritura: Solo propietarios
    """
    
    queryset = EncuestaConfig.objects.filter(activo=True)
    serializer_class = EncuestaConfigSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Permitir escritura solo a propietarios"""
        if self.action in ['update', 'partial_update']:
            # Verificar que el usuario sea propietario
            return [IsAuthenticated()]
        return super().get_permissions()
    
    def update(self, request, *args, **kwargs):
        """Solo propietarios pueden actualizar la configuración"""
        if not hasattr(request.user, 'propietario'):
            return Response(
                {'error': 'Solo los propietarios pueden modificar la configuración'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)
    
    def partial_update(self, request, *args, **kwargs):
        """Solo propietarios pueden actualizar la configuración"""
        if not hasattr(request.user, 'propietario'):
            return Response(
                {'error': 'Solo los propietarios pueden modificar la configuración'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().partial_update(request, *args, **kwargs)
    
    def list(self, request):
        """Retornar la configuración activa"""
        config = EncuestaConfig.get_config()
        serializer = self.get_serializer(config)
        return Response(serializer.data)


class TurnoEncuestaInfoView(generics.RetrieveAPIView):
    """
    Vista para obtener información de un turno para completar la encuesta
    Permite acceso sin autenticación usando el ID del turno
    """
    
    permission_classes = [AllowAny]
    
    def retrieve(self, request, turno_id=None):
        """Obtener información del turno para la encuesta"""
        try:
            turno = Turno.objects.select_related(
                'cliente__user',
                'empleado__user',
                'servicio'
            ).get(id=turno_id)
            
            # Verificar si el turno está completado
            if turno.estado != 'completado':
                return Response(
                    {'error': 'Este turno aún no está completado'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Verificar si ya tiene encuesta
            if hasattr(turno, 'encuesta'):
                return Response(
                    {'error': 'Este turno ya tiene una encuesta respondida'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Retornar información del turno
            return Response({
                'turno_id': turno.id,
                'cliente': {
                    'nombre': turno.cliente.nombre_completo,
                },
                'empleado': {
                    'id': turno.empleado.id,
                    'nombre': turno.empleado.nombre_completo,
                    'especialidad': turno.empleado.get_especialidades_display(),
                },
                'servicio': {
                    'nombre': turno.servicio.nombre,
                    'duracion': turno.servicio.duracion_horas,
                },
                'fecha_hora': turno.fecha_hora,
                'precio': float(turno.precio_final),
            })
            
        except Turno.DoesNotExist:
            return Response(
                {'error': 'Turno no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )


# ==========================================
# VIEWSETS PARA SISTEMA PARAMETRIZADO
# ==========================================

class EncuestaPreguntaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar preguntas dinámicas de encuestas.
    
    Endpoints:
    - GET /api/encuestas/preguntas/ - Listar preguntas activas
    - POST /api/encuestas/preguntas/ - Crear nueva pregunta (solo propietario)
    - PUT/PATCH /api/encuestas/preguntas/:id/ - Actualizar pregunta (solo propietario)
    - DELETE /api/encuestas/preguntas/:id/ - Desactivar pregunta (solo propietario)
    """
    
    queryset = EncuestaPregunta.objects.all()
    serializer_class = EncuestaPreguntaSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filtrar preguntas activas por defecto"""
        queryset = super().get_queryset()
        
        # Si el usuario no es propietario, solo ver preguntas activas
        if self.request.user.role not in ['propietario', 'superusuario']:
            queryset = queryset.filter(is_active=True)
        
        # Ordenar por orden
        return queryset.order_by('orden')
    
    def create(self, request, *args, **kwargs):
        """Solo propietarios pueden crear preguntas"""
        if request.user.role not in ['propietario', 'superusuario']:
            return Response(
                {'error': 'Solo los propietarios pueden crear preguntas'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)
    
    def update(self, request, *args, **kwargs):
        """Solo propietarios pueden actualizar preguntas"""
        if request.user.role not in ['propietario', 'superusuario']:
            return Response(
                {'error': 'Solo los propietarios pueden modificar preguntas'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)
    
    def partial_update(self, request, *args, **kwargs):
        """Solo propietarios pueden actualizar preguntas"""
        if request.user.role not in ['propietario', 'superusuario']:
            return Response(
                {'error': 'Solo los propietarios pueden modificar preguntas'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().partial_update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """Desactivar pregunta en lugar de eliminarla"""
        if request.user.role not in ['propietario', 'superusuario']:
            return Response(
                {'error': 'Solo los propietarios pueden desactivar preguntas'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        
        return Response(
            {'message': 'Pregunta desactivada exitosamente'},
            status=status.HTTP_200_OK
        )
    
    @action(detail=False, methods=['get'])
    def activas(self, request):
        """Obtener solo preguntas activas (para formularios de encuesta)"""
        preguntas = self.get_queryset().filter(is_active=True)
        serializer = self.get_serializer(preguntas, many=True)
        return Response(serializer.data)


class EncuestaRespuestaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para encuestas con sistema parametrizado.
    
    Permite crear encuestas usando preguntas dinámicas configuradas por el propietario.
    Los clientes responden a las preguntas activas sin límite fijo.
    
    Endpoints:
    - GET /api/encuestas/respuestas/ - Listar encuestas parametrizadas
    - POST /api/encuestas/respuestas/ - Crear encuesta con respuestas dinámicas
    - GET /api/encuestas/respuestas/:id/ - Ver detalle con todas las respuestas
    """
    
    queryset = Encuesta.objects.select_related(
        'cliente__user',
        'empleado__user',
        'turno__servicio'
    ).prefetch_related('respuestas__pregunta').all()
    
    serializer_class = EncuestaRespuestaSerializer
    permission_classes = [AllowAny]  # Permitir acceso público para responder
    pagination_class = CustomPageNumberPagination
    
    def get_queryset(self):
        """Filtrar por usuario si está autenticado"""
        if not self.request.user.is_authenticated:
            return self.queryset.none()
        
        user = self.request.user
        queryset = super().get_queryset()
        
        # Propietarios ven todas
        if user.role in ['propietario', 'superusuario']:
            return queryset
        
        # Profesionales ven solo sus encuestas
        if user.role == 'profesional' and hasattr(user, 'profesional_profile'):
            return queryset.filter(empleado=user.profesional_profile)
        
        # Clientes ven solo sus encuestas
        if user.role == 'cliente' and hasattr(user, 'cliente_profile'):
            return queryset.filter(cliente=user.cliente_profile)
        
        return queryset.none()
    
    def create(self, request, *args, **kwargs):
        """Crear encuesta con validaciones"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        encuesta = serializer.save()
        
        # Retornar con respuestas incluidas
        response_serializer = self.get_serializer(encuesta)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
