from rest_framework import serializers
from .models import Empleado, HorarioEmpleado
from django.contrib.auth import get_user_model
from django.db import transaction

User = get_user_model()


class EmpleadoSerializer(serializers.ModelSerializer):
    """
    Serializador completo para Profesional con creación de usuario integrada.
    Nota: Se mantiene el nombre 'EmpleadoSerializer' por compatibilidad con las vistas.
    """

    # Campos de solo lectura para mostrar info del usuario
    user = serializers.StringRelatedField(read_only=True)
    especialidad_display = serializers.CharField(
        source="get_especialidades_display", read_only=True
    )

    # Campos de escritura para crear el usuario
    username = serializers.CharField(write_only=True, required=False)
    email = serializers.EmailField(write_only=True, required=False)
    dni = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(
        write_only=True, required=False, default="profesional123"
    )
    first_name = serializers.CharField(write_only=True, required=False)
    last_name = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Empleado
        fields = "__all__"
        extra_kwargs = {"user": {"read_only": True}}

    @transaction.atomic
    def create(self, validated_data):
        """
        Crear usuario y profesional en una transacción atómica
        """
        # Extraer datos del usuario
        username = validated_data.pop("username", None)
        email = validated_data.pop("email", None)
        dni = validated_data.pop("dni", None)
        password = validated_data.pop("password", "profesional123")
        first_name = validated_data.pop("first_name", "")
        last_name = validated_data.pop("last_name", "")

        # Crear o buscar el usuario
        if username and email:
            # Verificar si ya existe un usuario con ese email o username
            if User.objects.filter(email=email).exists():
                raise serializers.ValidationError(
                    {"email": "Ya existe un usuario con este email"}
                )
            if User.objects.filter(username=username).exists():
                raise serializers.ValidationError(
                    {"username": "Ya existe un usuario con este nombre de usuario"}
                )
            if dni and User.objects.filter(dni=dni).exists():
                raise serializers.ValidationError(
                    {"dni": "Ya existe un usuario con este DNI"}
                )

            # Crear el usuario con rol de profesional
            user = User.objects.create_user(
                username=username,
                email=email,
                dni=dni,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role="profesional",  # Asignar rol de profesional
            )
        else:
            raise serializers.ValidationError(
                {
                    "username": "El nombre de usuario es requerido",
                    "email": "El email es requerido",
                }
            )

        # Crear el profesional asociado al usuario
        validated_data["user"] = user
        profesional = Empleado.objects.create(**validated_data)

        return profesional

    @transaction.atomic
    def update(self, instance, validated_data):
        """
        Actualizar profesional y opcionalmente su usuario
        """
        # Extraer datos del usuario si se proporcionan
        username = validated_data.pop("username", None)
        email = validated_data.pop("email", None)
        dni = validated_data.pop("dni", None)
        password = validated_data.pop("password", None)
        first_name = validated_data.pop("first_name", None)
        last_name = validated_data.pop("last_name", None)

        # Actualizar usuario si se proporcionan datos
        if instance.user:
            if email and email != instance.user.email:
                if (
                    User.objects.filter(email=email)
                    .exclude(id=instance.user.id)
                    .exists()
                ):
                    raise serializers.ValidationError(
                        {"email": "Ya existe un usuario con este email"}
                    )
                instance.user.email = email

            if username and username != instance.user.username:
                if (
                    User.objects.filter(username=username)
                    .exclude(id=instance.user.id)
                    .exists()
                ):
                    raise serializers.ValidationError(
                        {"username": "Ya existe un usuario con este nombre de usuario"}
                    )
                instance.user.username = username

            if dni and dni != instance.user.dni:
                if User.objects.filter(dni=dni).exclude(id=instance.user.id).exists():
                    raise serializers.ValidationError(
                        {"dni": "Ya existe un usuario con este DNI"}
                    )
                instance.user.dni = dni

            if first_name:
                instance.user.first_name = first_name
            if last_name:
                instance.user.last_name = last_name
            if password:
                instance.user.set_password(password)

            instance.user.save()

        # Actualizar profesional
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        return instance


class EmpleadoListSerializer(serializers.ModelSerializer):
    """
    Serializador simplificado para listado de profesionales.
    Nota: Se mantiene el nombre 'EmpleadoListSerializer' por compatibilidad.
    """

    user = serializers.StringRelatedField(read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    user_dni = serializers.CharField(source="user.dni", read_only=True)
    especialidad_display = serializers.CharField(
        source="get_especialidades_display", read_only=True
    )
    biografia = serializers.CharField(read_only=True)
    nivel_experiencia = serializers.SerializerMethodField()

    def get_nivel_experiencia(self, obj):
        """Obtener nivel de experiencia para el servicio actual"""
        request = self.context.get("request")
        if request:
            servicio_id = request.query_params.get("servicio")
            if servicio_id:
                from .models import EmpleadoServicio

                relacion = EmpleadoServicio.objects.filter(
                    empleado=obj, servicio_id=servicio_id
                ).first()
                if relacion:
                    return {
                        "nivel": relacion.nivel_experiencia,
                        "nivel_display": relacion.get_nivel_experiencia_display(),
                    }
        return None

    class Meta:
        model = Empleado
        fields = (
            "id",
            "user",
            "username",
            "email",
            "first_name",
            "last_name",
            "user_dni",
            "especialidades",
            "especialidad_display",
            "fecha_ingreso",
            "horario_entrada",
            "horario_salida",
            "dias_trabajo",
            "comision_porcentaje",
            "is_disponible",
            "biografia",
            "nivel_experiencia",
            "created_at",
            "updated_at",
        )


class HorarioEmpleadoSerializer(serializers.ModelSerializer):
    """
    Serializer para horarios detallados de profesionales.
    Nota: Se mantiene el nombre 'HorarioEmpleadoSerializer' por compatibilidad.
    """

    dia_semana_display = serializers.CharField(
        source="get_dia_semana_display", read_only=True
    )

    class Meta:
        model = HorarioEmpleado
        fields = [
            "id",
            "empleado",
            "dia_semana",
            "dia_semana_display",
            "hora_inicio",
            "hora_fin",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, data):
        """Validar que hora_inicio < hora_fin"""
        if data.get("hora_inicio") and data.get("hora_fin"):
            if data["hora_inicio"] >= data["hora_fin"]:
                raise serializers.ValidationError(
                    {"hora_fin": "La hora de fin debe ser mayor a la hora de inicio"}
                )
        return data
