"""Serializers para la app de turnos"""

from rest_framework import serializers
from .models import Turno, HistorialTurno
from apps.clientes.serializers import ClienteListSerializer
from apps.empleados.serializers import EmpleadoListSerializer
from apps.servicios.serializers import ServicioSerializer


class TurnoListSerializer(serializers.ModelSerializer):
    """Serializer para listar turnos (vista resumida)"""

    cliente_nombre = serializers.CharField(
        source="cliente.nombre_completo", read_only=True
    )
    cliente_email = serializers.EmailField(source="cliente.email", read_only=True)
    empleado_nombre = serializers.CharField(
        source="empleado.nombre_completo", read_only=True
    )
    empleado_especialidad = serializers.CharField(
        source="empleado.get_especialidades_display", read_only=True
    )
    servicio_nombre = serializers.CharField(source="servicio.nombre", read_only=True)
    servicio_duracion = serializers.CharField(
        source="servicio.duracion_horas", read_only=True
    )
    categoria_nombre = serializers.CharField(
        source="servicio.categoria.nombre", read_only=True
    )
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    fecha_hora_fin = serializers.DateTimeField(read_only=True)
    puede_cancelar = serializers.SerializerMethodField()

    class Meta:
        model = Turno
        fields = [
            "id",
            "cliente",
            "cliente_nombre",
            "cliente_email",
            "empleado",
            "empleado_nombre",
            "empleado_especialidad",
            "servicio",
            "servicio_nombre",
            "servicio_duracion",
            "categoria_nombre",
            "fecha_hora",
            "fecha_hora_fin",
            "fecha_hora_completado",
            "estado",
            "estado_display",
            "precio_final",
            "puede_cancelar",
            "notas_cliente",
            "notas_empleado",
            "created_at",
            "updated_at",
        ]

    def get_puede_cancelar(self, obj):
        return obj.puede_cancelar()


class TurnoDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para un turno específico"""

    cliente = ClienteListSerializer(read_only=True)
    empleado = EmpleadoListSerializer(read_only=True)
    servicio = ServicioSerializer(read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    fecha_hora_fin = serializers.DateTimeField(read_only=True)
    duracion = serializers.CharField(read_only=True)
    puede_cancelar = serializers.SerializerMethodField()

    class Meta:
        model = Turno
        fields = "__all__"

    def get_puede_cancelar(self, obj):
        return obj.puede_cancelar()


class TurnoCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear turnos"""

    class Meta:
        model = Turno
        fields = [
            "cliente",
            "empleado",
            "servicio",
            "fecha_hora",
            "notas_cliente",
            "precio_final",
        ]

    def validate(self, data):
        """Validaciones personalizadas"""
        from django.utils import timezone
        from datetime import timedelta

        # Validar que la fecha sea futura
        if data["fecha_hora"] < timezone.now():
            raise serializers.ValidationError(
                {"fecha_hora": "No se puede agendar un turno en el pasado."}
            )

        # Validar que el empleado esté disponible
        empleado = data["empleado"]
        fecha_hora = data["fecha_hora"]
        servicio = data["servicio"]

        # Calcular hora de fin del turno
        hora_fin = fecha_hora + timedelta(minutes=servicio.duracion_minutos)

        # Buscar turnos que se solapen
        # Como fecha_hora_fin es una property, debemos buscar turnos cuya fecha_hora
        # esté dentro del rango del nuevo turno
        turnos_existentes = Turno.objects.filter(
            empleado=empleado,
            estado__in=["pendiente", "confirmado", "en_proceso"],
        ).exclude(id=self.instance.id if self.instance else None)

        # Verificar solapamiento manualmente
        for turno in turnos_existentes:
            turno_fin = turno.fecha_hora + timedelta(
                minutes=turno.servicio.duracion_minutos
            )
            # Hay solapamiento si:
            # - El nuevo turno empieza antes de que termine un turno existente Y
            # - El nuevo turno termina después de que empiece un turno existente
            if fecha_hora < turno_fin and hora_fin > turno.fecha_hora:
                raise serializers.ValidationError(
                    {
                        "fecha_hora": f"El empleado ya tiene un turno agendado en ese horario."
                    }
                )

        # Validar horario laboral del empleado
        dia_semana = fecha_hora.weekday()  # 0=Lunes, 6=Domingo
        dias_trabajo = empleado.dias_trabajo.split(",")
        dias_map = {"L": 0, "M": 1, "Mi": 2, "J": 3, "V": 4, "S": 5, "D": 6}

        # Convertir días de trabajo a números
        dias_numericos = []
        for dia in dias_trabajo:
            dia = dia.strip()
            if dia in dias_map:
                dias_numericos.append(dias_map[dia])

        if dia_semana not in dias_numericos:
            raise serializers.ValidationError(
                {"fecha_hora": f"El empleado no trabaja ese día."}
            )

        # Validar horario
        hora_turno = fecha_hora.time()
        if (
            hora_turno < empleado.horario_entrada
            or hora_turno > empleado.horario_salida
        ):
            raise serializers.ValidationError(
                {
                    "fecha_hora": f"El horario debe estar entre {empleado.horario_entrada} y {empleado.horario_salida}."
                }
            )

        return data

    def create(self, validated_data):
        # Establecer precio final si no se proporciona
        if not validated_data.get("precio_final"):
            validated_data["precio_final"] = validated_data["servicio"].precio

        return super().create(validated_data)


class TurnoUpdateSerializer(serializers.ModelSerializer):
    """Serializer para actualizar turnos"""

    class Meta:
        model = Turno
        fields = [
            "fecha_hora",
            "estado",
            "notas_cliente",
            "notas_empleado",
            "precio_final",
        ]

    def validate_estado(self, value):
        """Validar transiciones de estado permitidas"""
        if self.instance:
            estado_actual = self.instance.estado

            # Definir transiciones válidas
            transiciones_validas = {
                "pendiente": ["confirmado", "cancelado"],
                "confirmado": ["en_proceso", "cancelado", "no_asistio"],
                "en_proceso": ["completado", "cancelado"],
                "completado": [],  # No se puede cambiar
                "cancelado": [],  # No se puede cambiar
                "no_asistio": [],  # No se puede cambiar
            }

            if value != estado_actual and value not in transiciones_validas.get(
                estado_actual, []
            ):
                raise serializers.ValidationError(
                    f'No se puede cambiar de estado "{estado_actual}" a "{value}".'
                )

        return value


class HistorialTurnoSerializer(serializers.ModelSerializer):
    """Serializer para el historial de cambios"""

    usuario_nombre = serializers.CharField(source="usuario.full_name", read_only=True)

    class Meta:
        model = HistorialTurno
        fields = [
            "id",
            "turno",
            "usuario",
            "usuario_nombre",
            "accion",
            "estado_anterior",
            "estado_nuevo",
            "observaciones",
            "created_at",
        ]
        read_only_fields = ["created_at"]
