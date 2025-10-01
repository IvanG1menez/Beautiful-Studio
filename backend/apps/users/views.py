from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.views import ObtainAuthToken
from django.contrib.auth import authenticate
from .models import User
from .serializers import (
    UserSerializer,
    UserProfileSerializer,
    UserUpdateSerializer,
    CustomAuthTokenSerializer,
)

# Import Token con manejo de errores
try:
    from rest_framework.authtoken.models import Token
except ImportError:
    Token = None


class UserCreateView(generics.CreateAPIView):
    """
    Vista para registrar nuevos usuarios
    """

    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]


class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    Vista para ver y actualizar el perfil del usuario autenticado
    """

    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method == "PUT" or self.request.method == "PATCH":
            return UserUpdateSerializer
        return UserProfileSerializer


class CustomObtainAuthToken(ObtainAuthToken):
    """
    Vista personalizada basada en la nativa de Django que usa email para login
    """

    serializer_class = CustomAuthTokenSerializer

    def post(self, request, *args, **kwargs):
        if Token is None:
            return Response(
                {
                    "error": "Sistema de tokens no configurado. Contacta al administrador.",
                    "error_code": "TOKEN_SYSTEM_NOT_CONFIGURED",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        serializer = self.serializer_class(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        try:
            token, created = Token.objects.get_or_create(user=user)
        except Exception as e:
            return Response(
                {
                    "error": f"Error al crear token: {str(e)}",
                    "error_code": "TOKEN_CREATION_ERROR",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "token": token.key,
                "user": UserProfileSerializer(user).data,
            }
        )


# Vista personalizada original (mantener como alternativa)
@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """
    Vista de login que retorna token de autenticación
    con manejo robusto de errores
    """
    email = request.data.get("email")
    password = request.data.get("password")

    # Validación de campos requeridos
    if not email or not password:
        return Response(
            {
                "error": "Email y contraseña son requeridos",
                "error_code": "MISSING_CREDENTIALS",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Validación básica del formato de email
    if "@" not in email:
        return Response(
            {
                "error": "Formato de email inválido",
                "error_code": "INVALID_EMAIL_FORMAT",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        # Buscar usuario por email
        user_obj = User.objects.get(email=email.lower().strip())

        # Verificar si la cuenta está activa antes de autenticar
        if not user_obj.is_active:
            return Response(
                {
                    "error": (
                        "Tu cuenta está desactivada. " "Contacta al administrador."
                    ),
                    "error_code": "ACCOUNT_DISABLED",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Intentar autenticar con las credenciales
        authenticated_user = authenticate(
            request=request, username=email.lower().strip(), password=password
        )

        if authenticated_user is None:
            # Usuario existe pero contraseña incorrecta
            return Response(
                {
                    "error": "Contraseña incorrecta",
                    "error_code": "INVALID_PASSWORD",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Autenticación exitosa: crear/obtener token
        if Token is None:
            return Response(
                {
                    "error": "Sistema de tokens no configurado. Contacta al administrador.",
                    "error_code": "TOKEN_SYSTEM_NOT_CONFIGURED",
                    "details": "rest_framework.authtoken no está configurado correctamente",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        try:
            token, created = Token.objects.get_or_create(user=authenticated_user)
        except Exception as e:
            return Response(
                {
                    "error": f"Error al crear token de autenticación: {str(e)}",
                    "error_code": "TOKEN_CREATION_ERROR",
                    "details": "Posiblemente las migraciones no se han ejecutado",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "token": token.key,
                "user": UserProfileSerializer(authenticated_user).data,
            },
            status=status.HTTP_200_OK,
        )

    except User.DoesNotExist:
        # Usuario no existe en el sistema
        return Response(
            {
                "error": "No existe una cuenta asociada a este email",
                "error_code": "USER_NOT_FOUND",
            },
            status=status.HTTP_404_NOT_FOUND,
        )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    """
    Vista de logout que elimina el token
    """
    if Token is None:
        return Response(
            {
                "error": "Sistema de tokens no configurado",
                "error_code": "TOKEN_SYSTEM_NOT_CONFIGURED",
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        request.user.auth_token.delete()
        return Response(
            {"message": "Logout exitoso"},
            status=status.HTTP_200_OK,
        )
    except AttributeError:
        return Response(
            {"error": "El usuario no tiene un token de autenticación"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Token.DoesNotExist:
        return Response(
            {"error": "Token de autenticación no encontrado"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as e:
        return Response(
            {
                "error": f"Error al eliminar token: {str(e)}",
                "error_code": "TOKEN_DELETION_ERROR",
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
