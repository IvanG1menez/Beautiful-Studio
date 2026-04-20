from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "dni",
            "first_name",
            "last_name",
            "phone",
            "role",
            "password",
        )
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    cliente_profile = serializers.SerializerMethodField()
    profesional_profile = serializers.SerializerMethodField()
    empleado_id = serializers.SerializerMethodField()
    telegram_chat_id = serializers.SerializerMethodField()
    has_telegram_link = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = "__all__"

    def get_cliente_profile(self, obj):
        """Obtener perfil de cliente si existe"""
        if hasattr(obj, "cliente_profile"):
            from apps.clientes.serializers import ClienteDetailSerializer

            return ClienteDetailSerializer(obj.cliente_profile).data
        return None

    def get_profesional_profile(self, obj):
        """Obtener perfil de profesional si existe"""
        if hasattr(obj, "profesional_profile"):
            from apps.empleados.serializers import EmpleadoListSerializer

            return EmpleadoListSerializer(obj.profesional_profile).data
        return None

    def get_empleado_id(self, obj):
        """Devolver el ID del perfil de empleado/profesional si existe.

        Esto permite que el frontend use user.empleado_id directamente
        sin tener que volver a consultar /empleados/me/ al recargar.
        """
        if hasattr(obj, "profesional_profile") and obj.profesional_profile:
            return obj.profesional_profile.id
        return None

    def _get_telegram_link(self, obj):
        if not hasattr(obj, "cliente_profile") or not obj.cliente_profile:
            return None

        from apps.telegram_bot.models import TelegramLink

        return (
            TelegramLink.objects.filter(cliente=obj.cliente_profile, is_verified=True)
            .order_by("-last_seen_at")
            .first()
        )

    def get_telegram_chat_id(self, obj):
        link = self._get_telegram_link(obj)
        return link.chat_id if link else None

    def get_has_telegram_link(self, obj):
        return self._get_telegram_link(obj) is not None


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "phone",
        ]

    def validate_phone(self, value):
        if value in [None, ""]:
            return value

        current_user = self.instance
        exists = (
            User.objects.filter(phone=value)
            .exclude(id=current_user.id)
            .exists()
        )
        if exists:
            raise serializers.ValidationError(
                "Este telefono ya esta registrado por otro usuario."
            )
        return value


class CustomAuthTokenSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        if email and password:
            # Como USERNAME_FIELD = "email", usamos email como username
            user = authenticate(
                request=self.context.get("request"),
                username=email.lower().strip(),
                password=password,
            )

            if not user:
                msg = (
                    "No es posible iniciar sesión con las credenciales proporcionadas."
                )
                raise serializers.ValidationError(msg, code="authorization")
        else:
            msg = 'Debe incluir "email" y "password".'
            raise serializers.ValidationError(msg, code="authorization")

        attrs["user"] = user
        return attrs
