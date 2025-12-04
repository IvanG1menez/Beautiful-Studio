import datetime

from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token

from .models import PermisoAdicional, Configuracion, AuditoriaAcciones, ConfiguracionSSO
from .serializers import (
    RegisterSerializer,
    UserSerializer,
    PermisoAdicionalSerializer,
    ConfiguracionSerializer,
    AuditoriaAccionesSerializer,
    UsuarioBasicoSerializer,
    ConfiguracionSSOSerializer,
    ConfiguracionSSOPublicSerializer,
)


User = get_user_model()


# Vistas de autenticación


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    """
    Vista para registrar nuevos usuarios
    Asigna automáticamente el rol 'cliente'
    """
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()

        # Crear token de autenticación
        token, created = Token.objects.get_or_create(user=user)

        # Registrar acción en auditoría
        AuditoriaAcciones.objects.create(
            usuario=user,
            accion="crear",
            modelo_afectado="User",
            objeto_id=user.id,
            detalles={"tipo": "registro_usuario"},
            ip_address=get_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        )

        # Serializar datos del usuario para la respuesta
        user_data = UserSerializer(user).data

        return Response(
            {
                "message": "Usuario registrado exitosamente",
                "user": user_data,
                "token": token.key,
                "role": user.role,
            },
            status=status.HTTP_201_CREATED,
        )

    return Response({"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    """
    Vista para autenticar usuarios
    Devuelve el token de autenticación y el rol del usuario
    """
    print("Iniciando proceso de login")
    email = request.data.get("email")
    password = request.data.get("password")

    if not email or not password:
        return Response(
            {"error": "Email y contraseña son requeridos"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        # Buscar usuario por email
        user = User.objects.get(email=email.lower().strip())

        # Verificar si la cuenta está activa
        if not user.is_active:
            return Response(
                {
                    "error": (
                        "Tu cuenta está desactivada. " "Contacta al administrador."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Autenticar usuario
        authenticated_user = authenticate(
            request=request, username=user.username, password=password
        )

        if authenticated_user is None:
            return Response(
                {"error": "Contraseña incorrecta"}, status=status.HTTP_401_UNAUTHORIZED
            )

        # Crear/obtener token
        token, created = Token.objects.get_or_create(user=authenticated_user)

        # Registrar acción en auditoría
        AuditoriaAcciones.objects.create(
            usuario=authenticated_user,
            accion="login",
            modelo_afectado="User",
            objeto_id=authenticated_user.id,
            ip_address=get_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        )

        # Serializar datos del usuario
        user_data = UserSerializer(authenticated_user).data

        return Response(
            {
                "message": "Inicio de sesión exitoso",
                "user": user_data,
                "token": token.key,
                "role": authenticated_user.role,
            },
            status=status.HTTP_200_OK,
        )

    except User.DoesNotExist:
        return Response(
            {"error": "No existe una cuenta asociada a este email"},
            status=status.HTTP_404_NOT_FOUND,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    """
    Vista para cerrar sesión (eliminar token)
    """
    try:
        # Registrar acción en auditoría
        AuditoriaAcciones.objects.create(
            usuario=request.user,
            accion="logout",
            modelo_afectado="User",
            objeto_id=request.user.id,
            ip_address=get_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        )

        request.user.auth_token.delete()
        return Response(
            {"message": "Sesión cerrada exitosamente"}, status=status.HTTP_200_OK
        )
    except AttributeError:
        return Response(
            {"error": "El usuario no tiene un token de autenticación"},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """
    Simple health check endpoint for monitoring and Next.js integration testing
    """
    return Response(
        {
            "status": "healthy",
            "timestamp": datetime.datetime.now().isoformat(),
            "service": "Beautiful Studio Backend",
            "version": "1.0.0",
        },
        status=status.HTTP_200_OK,
    )


# Función utilitaria


def get_client_ip(request):
    """
    Obtener la IP del cliente desde la request
    """
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0]
    else:
        ip = request.META.get("REMOTE_ADDR")
    return ip


# ViewSets para modelos de negocio


class PermisoAdicionalViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar Permisos Adicionales
    """

    queryset = PermisoAdicional.objects.all()
    serializer_class = PermisoAdicionalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Filtrar permisos activos por defecto
        """
        queryset = PermisoAdicional.objects.all()
        activo = self.request.query_params.get("activo", None)

        if activo is not None:
            queryset = queryset.filter(activo=activo.lower() == "true")

        return queryset.order_by("nombre")


class ConfiguracionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar Configuraciones del sistema
    """

    queryset = Configuracion.objects.all()
    serializer_class = ConfiguracionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Filtrar configuraciones con opciones adicionales
        """
        queryset = Configuracion.objects.all()

        # Filtros opcionales
        activo = self.request.query_params.get("activo", None)
        tipo_dato = self.request.query_params.get("tipo_dato", None)
        search = self.request.query_params.get("search", None)

        if activo is not None:
            queryset = queryset.filter(activo=activo.lower() == "true")

        if tipo_dato:
            queryset = queryset.filter(tipo_dato=tipo_dato)

        if search:
            queryset = queryset.filter(clave__icontains=search) | queryset.filter(
                descripcion__icontains=search
            )

        return queryset.order_by("clave")


class AuditoriaAccionesViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet de solo lectura para consultar Auditoría de Acciones
    """

    queryset = AuditoriaAcciones.objects.all()
    serializer_class = AuditoriaAccionesSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Filtrar acciones de auditoría con opciones adicionales
        """
        queryset = AuditoriaAcciones.objects.select_related("usuario")

        # Filtros opcionales
        usuario = self.request.query_params.get("usuario", None)
        accion = self.request.query_params.get("accion", None)
        modelo = self.request.query_params.get("modelo", None)
        fecha_desde = self.request.query_params.get("fecha_desde", None)
        fecha_hasta = self.request.query_params.get("fecha_hasta", None)

        if usuario:
            queryset = queryset.filter(usuario_id=usuario)

        if accion:
            queryset = queryset.filter(accion=accion)

        if modelo:
            queryset = queryset.filter(modelo_afectado=modelo)

        if fecha_desde:
            queryset = queryset.filter(created_at__date__gte=fecha_desde)

        if fecha_hasta:
            queryset = queryset.filter(created_at__date__lte=fecha_hasta)

        return queryset.order_by("-created_at")


# ViewSet adicional para usuarios básicos


class UsuarioBasicoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet de solo lectura para consultar información básica de usuarios
    """

    queryset = User.objects.all()
    serializer_class = UsuarioBasicoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Filtrar usuarios con opciones básicas
        """
        queryset = User.objects.filter(is_active=True)

        # Filtros opcionales
        role = self.request.query_params.get("role", None)
        search = self.request.query_params.get("search", None)

        if role:
            queryset = queryset.filter(role=role)

        if search:
            queryset = (
                queryset.filter(first_name__icontains=search)
                | queryset.filter(last_name__icontains=search)
                | queryset.filter(username__icontains=search)
                | queryset.filter(email__icontains=search)
            )

        return queryset.order_by("first_name", "last_name")


# ==========================================
# Vistas para Configuración SSO
# ==========================================


@api_view(['GET'])
@permission_classes([AllowAny])
def configuracion_sso_public_view(request):
    """
    Vista pública para obtener configuración de SSO (sin credenciales)
    Permite al frontend saber si debe mostrar el botón de Google SSO
    """
    config = ConfiguracionSSO.get_config()
    serializer = ConfiguracionSSOPublicSerializer(config)
    return Response(serializer.data)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def configuracion_sso_view(request):
    """
    Vista para gestionar configuración de SSO (solo propietario)
    GET: Obtener configuración completa (con credenciales para propietario)
    PATCH: Actualizar configuración (solo propietario)
    """
    # Verificar que el usuario sea propietario
    if request.user.role != 'propietario':
        return Response(
            {'error': 'Solo el propietario puede gestionar la configuración de SSO'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    config = ConfiguracionSSO.get_config()
    
    if request.method == 'GET':
        serializer = ConfiguracionSSOSerializer(config)
        return Response(serializer.data)
    
    elif request.method == 'PATCH':
        serializer = ConfiguracionSSOSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            
            # Registrar acción en auditoría (opcional, no falla si la tabla no existe)
            try:
                AuditoriaAcciones.objects.create(
                    usuario=request.user,
                    accion='editar',
                    modelo_afectado='ConfiguracionSSO',
                    objeto_id=config.id,
                    detalles={'cambios': request.data},
                    ip_address=get_client_ip(request),
                    user_agent=request.META.get('HTTP_USER_AGENT', '')
                )
            except Exception as e:
                # Si falla la auditoría, registrar en logs pero no fallar la request
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f'No se pudo registrar auditoría: {e}')
            
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
