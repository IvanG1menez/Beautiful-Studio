from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .models import (
    PermisoAdicional,
    Configuracion,
    AuditoriaAcciones,
    ConfiguracionSSO,
    ConfiguracionGlobal,
)


User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer para el modelo User con información básica
    """

    full_name = serializers.ReadOnlyField(source="get_full_name")

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "role",
            "is_active",
            "created_at",
            "updated_at",
            "full_name",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer para el registro de nuevos usuarios
    """

    password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )
    password_confirm = serializers.CharField(
        write_only=True, style={"input_type": "password"}
    )

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "password",
            "password_confirm",
        ]

    def validate(self, attrs):
        """
        Validar que las contraseñas coincidan
        """
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError("Las contraseñas no coinciden.")
        return attrs

    def create(self, validated_data):
        """
        Crear un nuevo usuario con rol 'cliente' por defecto
        """
        # Remover password_confirm del diccionario
        validated_data.pop("password_confirm", None)

        # Asignar rol cliente por defecto
        validated_data["role"] = "cliente"

        # Crear el usuario
        password = validated_data.pop("password")
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()

        return user


class PermisoAdicionalSerializer(serializers.ModelSerializer):
    """
    Serializer para el modelo PermisoAdicional
    """

    nombre_display = serializers.ReadOnlyField(source="get_nombre_display")
    total_usuarios = serializers.ReadOnlyField(source="usuarios.count")

    class Meta:
        model = PermisoAdicional
        fields = [
            "id",
            "nombre",
            "nombre_display",
            "descripcion",
            "activo",
            "usuarios",
            "total_usuarios",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ConfiguracionSerializer(serializers.ModelSerializer):
    """
    Serializer para el modelo Configuracion
    """

    valor_parsed = serializers.ReadOnlyField(source="get_valor_parsed")

    class Meta:
        model = Configuracion
        fields = [
            "id",
            "clave",
            "valor",
            "valor_parsed",
            "descripcion",
            "tipo_dato",
            "activo",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_valor(self, value):
        """
        Validar el valor según el tipo de dato
        """
        tipo_dato = self.initial_data.get("tipo_dato", "str")

        if tipo_dato == "int":
            try:
                int(value)
            except ValueError:
                raise serializers.ValidationError(
                    "El valor debe ser un número entero válido"
                )
        elif tipo_dato == "float":
            try:
                float(value)
            except ValueError:
                raise serializers.ValidationError(
                    "El valor debe ser un número decimal válido"
                )
        elif tipo_dato == "bool":
            if value.lower() not in ["true", "false", "1", "0", "yes", "no"]:
                raise serializers.ValidationError(
                    "El valor debe ser un booleano válido " "(true/false, 1/0, yes/no)"
                )
        elif tipo_dato == "json":
            try:
                import json

                json.loads(value)
            except (ValueError, TypeError):
                raise serializers.ValidationError("El valor debe ser un JSON válido")

        return value


class AuditoriaAccionesSerializer(serializers.ModelSerializer):
    """
    Serializer para el modelo AuditoriaAcciones
    """

    usuario_username = serializers.ReadOnlyField(source="usuario.username")
    accion_display = serializers.ReadOnlyField(source="get_accion_display")

    class Meta:
        model = AuditoriaAcciones
        fields = [
            "id",
            "usuario",
            "usuario_username",
            "accion",
            "accion_display",
            "modelo_afectado",
            "objeto_id",
            "detalles",
            "ip_address",
            "user_agent",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


# Serializers de solo lectura para reportes y consultas


class UsuarioBasicoSerializer(serializers.ModelSerializer):
    """
    Serializer básico para mostrar información mínima del usuario
    """

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "role"]
        read_only_fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "role",
        ]


class ConfiguracionSSOSerializer(serializers.ModelSerializer):
    """
    Serializer para la configuración de Google SSO (completo, para propietario)
    """

    class Meta:
        model = ConfiguracionSSO
        fields = [
            "id",
            "google_sso_activo",
            "autocreacion_cliente_sso",
            "client_id",
            "client_secret",
            "activo",
        ]
        read_only_fields = ["id"]
        # NO poner write_only en client_secret para que el propietario pueda verlo
        extra_kwargs = {"client_secret": {"required": False}}


class ConfiguracionSSOPublicSerializer(serializers.ModelSerializer):
    """
    Serializer público para la configuración de SSO (sin credenciales sensibles)
    """

    class Meta:
        model = ConfiguracionSSO
        fields = ["id", "google_sso_activo", "autocreacion_cliente_sso"]
        read_only_fields = ["id", "google_sso_activo", "autocreacion_cliente_sso"]


class ConfiguracionGlobalSerializer(serializers.ModelSerializer):
    """
    Serializer para la configuración global del negocio
    """

    class Meta:
        model = ConfiguracionGlobal
        fields = [
            "id",
            "min_horas_cancelacion_credito",
            "margen_fidelizacion_dias",
            "descuento_fidelizacion_pct",
            "capacidad_maxima_global",
            "activo",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
