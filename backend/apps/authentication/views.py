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


@api_view(["POST"])
@permission_classes([AllowAny])
def request_password_reset(request):
    """
    Vista para solicitar recuperación de contraseña
    Envía un email con un token de recuperación
    """
    import secrets
    from datetime import timedelta
    from django.utils import timezone
    from apps.emails.models import PasswordResetToken
    from apps.emails.services import EmailService

    email = request.data.get("email")

    if not email:
        return Response(
            {"error": "El email es requerido"}, status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # Buscar usuario por email
        user = User.objects.get(email=email)

        # Generar token único
        token = secrets.token_urlsafe(32)

        # Calcular fecha de expiración (1 hora)
        expires_at = timezone.now() + timedelta(hours=1)

        # Invalidar tokens anteriores del usuario
        PasswordResetToken.objects.filter(user=user, used=False).update(used=True)

        # Crear nuevo token
        reset_token = PasswordResetToken.objects.create(
            user=user, token=token, expires_at=expires_at
        )

        # Enviar email
        nombre_usuario = f"{user.first_name}" if user.first_name else ""
        email_enviado = EmailService.enviar_email_recuperacion_password(
            email=user.email, token=token, usuario_nombre=nombre_usuario
        )

        if email_enviado:
            # Registrar en auditoría
            AuditoriaAcciones.objects.create(
                usuario=user,
                accion="solicitar_reset_password",
                modelo_afectado="PasswordResetToken",
                objeto_id=reset_token.id,
                ip_address=get_client_ip(request),
                detalles={"email": user.email},
            )

            return Response(
                {
                    "message": "Se ha enviado un email con instrucciones para recuperar tu contraseña",
                    "email": email,
                },
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {"error": "Error al enviar el email. Intenta nuevamente."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    except User.DoesNotExist:
        # Por seguridad, no revelar si el email existe o no
        return Response(
            {
                "message": "Si el email está registrado, recibirás instrucciones para recuperar tu contraseña"
            },
            status=status.HTTP_200_OK,
        )
    except Exception as e:
        return Response(
            {"error": f"Error al procesar la solicitud: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password(request):
    """
    Vista para restablecer la contraseña usando el token
    """
    from django.utils import timezone
    from apps.emails.models import PasswordResetToken

    token = request.data.get("token")
    new_password = request.data.get("password")

    if not token or not new_password:
        return Response(
            {"error": "Token y contraseña son requeridos"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        # Buscar token
        reset_token = PasswordResetToken.objects.get(token=token)

        # Verificar si el token es válido
        if not reset_token.is_valid():
            if reset_token.used:
                error_msg = "Este enlace ya fue utilizado"
            else:
                error_msg = "Este enlace ha expirado"

            return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)

        # Cambiar contraseña
        user = reset_token.user
        user.set_password(new_password)
        user.save()

        # Marcar token como usado
        reset_token.mark_used()

        # Registrar en auditoría
        AuditoriaAcciones.objects.create(
            usuario=user,
            accion="reset_password",
            modelo_afectado="User",
            objeto_id=user.id,
            ip_address=get_client_ip(request),
            detalles={"metodo": "email_token"},
        )

        return Response(
            {"message": "Contraseña restablecida exitosamente"},
            status=status.HTTP_200_OK,
        )

    except PasswordResetToken.DoesNotExist:
        return Response({"error": "Token inválido"}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response(
            {"error": f"Error al restablecer contraseña: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
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


@api_view(["GET"])
@permission_classes([AllowAny])
def configuracion_sso_public_view(request):
    """
    Vista pública para obtener configuración de SSO (sin credenciales)
    Permite al frontend saber si debe mostrar el botón de Google SSO
    """
    config = ConfiguracionSSO.get_config()
    serializer = ConfiguracionSSOPublicSerializer(config)
    return Response(serializer.data)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def configuracion_sso_view(request):
    """
    Vista para gestionar configuración de SSO (solo propietario)
    GET: Obtener configuración completa (con credenciales para propietario)
    PATCH: Actualizar configuración (solo propietario)
    """
    # Verificar que el usuario sea propietario
    if request.user.role != "propietario":
        return Response(
            {"error": "Solo el propietario puede gestionar la configuración de SSO"},
            status=status.HTTP_403_FORBIDDEN,
        )

    config = ConfiguracionSSO.get_config()

    if request.method == "GET":
        serializer = ConfiguracionSSOSerializer(config)
        return Response(serializer.data)

    elif request.method == "PATCH":
        serializer = ConfiguracionSSOSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()

            # Registrar acción en auditoría (opcional, no falla si la tabla no existe)
            try:
                AuditoriaAcciones.objects.create(
                    usuario=request.user,
                    accion="editar",
                    modelo_afectado="ConfiguracionSSO",
                    objeto_id=config.id,
                    detalles={"cambios": request.data},
                    ip_address=get_client_ip(request),
                    user_agent=request.META.get("HTTP_USER_AGENT", ""),
                )
            except Exception as e:
                # Si falla la auditoría, registrar en logs pero no fallar la request
                import logging

                logger = logging.getLogger(__name__)
                logger.warning(f"No se pudo registrar auditoría: {e}")

            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
