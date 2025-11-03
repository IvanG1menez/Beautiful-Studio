"""Serializers para la app de clientes"""

from rest_framework import serializers
from .models import Cliente
from apps.users.models import User


class ClienteUserSerializer(serializers.ModelSerializer):
    """Serializer para los datos del usuario del cliente"""

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "dni",
            "is_active",
        ]
        read_only_fields = ["id"]


class ClienteListSerializer(serializers.ModelSerializer):
    """Serializer para listar clientes"""

    # Datos del usuario
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    user_dni = serializers.CharField(source="user.dni", read_only=True)
    is_active = serializers.BooleanField(source="user.is_active", read_only=True)

    # Propiedades calculadas
    nombre_completo = serializers.CharField(read_only=True)
    edad = serializers.IntegerField(read_only=True)
    tiempo_como_cliente = serializers.IntegerField(read_only=True)

    class Meta:
        model = Cliente
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "user_dni",
            "is_active",
            "fecha_nacimiento",
            "direccion",
            "preferencias",
            "fecha_primera_visita",
            "is_vip",
            "nombre_completo",
            "edad",
            "tiempo_como_cliente",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "nombre_completo",
            "edad",
            "tiempo_como_cliente",
        ]


class ClienteDetailSerializer(serializers.ModelSerializer):
    """Serializer para detalle de cliente"""

    user = ClienteUserSerializer(read_only=True)
    nombre_completo = serializers.CharField(read_only=True)
    edad = serializers.IntegerField(read_only=True)
    tiempo_como_cliente = serializers.IntegerField(read_only=True)

    class Meta:
        model = Cliente
        fields = [
            "id",
            "user",
            "fecha_nacimiento",
            "direccion",
            "preferencias",
            "fecha_primera_visita",
            "is_vip",
            "nombre_completo",
            "edad",
            "tiempo_como_cliente",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "nombre_completo",
            "edad",
            "tiempo_como_cliente",
        ]


class ClienteCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear cliente con su usuario"""

    # Campos del usuario
    username = serializers.CharField(write_only=True)
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, required=False)
    first_name = serializers.CharField(write_only=True)
    last_name = serializers.CharField(write_only=True)
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    dni = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Cliente
        fields = [
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "phone",
            "dni",
            "fecha_nacimiento",
            "direccion",
            "preferencias",
            "is_vip",
        ]

    def validate_username(self, value):
        """Validar que el username no exista"""
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Este nombre de usuario ya está en uso.")
        return value

    def validate_email(self, value):
        """Validar que el email no exista"""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                "Este correo electrónico ya está registrado."
            )
        return value

    def validate_dni(self, value):
        """Validar que el DNI no exista si se proporciona"""
        if value and User.objects.filter(dni=value).exists():
            raise serializers.ValidationError("Este DNI ya está registrado.")
        return value

    def create(self, validated_data):
        """Crear usuario y cliente"""
        # Extraer datos del usuario
        user_data = {
            "username": validated_data.pop("username"),
            "email": validated_data.pop("email"),
            "first_name": validated_data.pop("first_name"),
            "last_name": validated_data.pop("last_name"),
            "phone": validated_data.pop("phone", ""),
            "dni": validated_data.pop("dni", ""),
            "role": "cliente",
            "is_active": True,
        }

        # Password por defecto si no se proporciona
        password = validated_data.pop("password", "cliente123")

        # Crear usuario
        user = User.objects.create_user(password=password, **user_data)

        # Crear cliente
        cliente = Cliente.objects.create(user=user, **validated_data)

        return cliente


class ClienteUpdateSerializer(serializers.ModelSerializer):
    """Serializer para actualizar cliente"""

    # Campos del usuario (opcionales para actualización)
    first_name = serializers.CharField(source="user.first_name", required=False)
    last_name = serializers.CharField(source="user.last_name", required=False)
    phone = serializers.CharField(source="user.phone", required=False, allow_blank=True)
    email = serializers.EmailField(source="user.email", required=False)

    class Meta:
        model = Cliente
        fields = [
            "first_name",
            "last_name",
            "phone",
            "email",
            "fecha_nacimiento",
            "direccion",
            "preferencias",
            "is_vip",
        ]

    def validate_email(self, value):
        """Validar que el email no exista en otro usuario"""
        user = self.instance.user
        if User.objects.filter(email=value).exclude(id=user.id).exists():
            raise serializers.ValidationError(
                "Este correo electrónico ya está registrado."
            )
        return value

    def update(self, instance, validated_data):
        """Actualizar usuario y cliente"""
        # Extraer datos del usuario si existen
        user_data = {}
        if "user" in validated_data:
            user_data = validated_data.pop("user")

        # Actualizar usuario
        if user_data:
            user = instance.user
            for attr, value in user_data.items():
                setattr(user, attr, value)
            user.save()

        # Actualizar cliente
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        return instance
