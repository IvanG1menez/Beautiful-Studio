"""Serializers para la app de turnos"""

from decimal import Decimal
from django.utils import timezone

from rest_framework import serializers
from .models import Turno, HistorialTurno
from apps.clientes.serializers import ClienteListSerializer
from apps.empleados.serializers import EmpleadoListSerializer
from apps.servicios.serializers import ServicioSerializer


def calcular_monto_pendiente_turno(obj: Turno) -> Decimal:
    """Calcula el saldo real que falta cobrar para completar el turno."""

    precio_base = Decimal(obj.precio_final if obj.precio_final is not None else 0)
    if precio_base <= 0 and obj.servicio:
        precio_base = Decimal(obj.servicio.precio or 0)

    senia = Decimal(obj.senia_pagada or 0)
    descuento = Decimal("0.00")

    try:
        from .models import LogReasignacion

        log = (
            LogReasignacion.objects.filter(turno_cancelado=obj, estado_final="aceptada")
            .order_by("-id")
            .first()
        )
        if log and log.monto_descuento is not None:
            descuento = Decimal(log.monto_descuento)
    except Exception:
        descuento = Decimal("0.00")

    return Turno.calcular_pago_final(precio_base, descuento, senia)


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
    servicio_precio = serializers.DecimalField(
        source="servicio.precio", max_digits=10, decimal_places=2, read_only=True
    )
    servicio_duracion = serializers.CharField(
        source="servicio.duracion_horas", read_only=True
    )
    categoria_nombre = serializers.CharField(
        source="servicio.categoria.nombre", read_only=True
    )
    sala_nombre = serializers.CharField(source="sala.nombre", read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    fecha_hora_fin = serializers.DateTimeField(read_only=True)
    puede_cancelar = serializers.SerializerMethodField()
    reacomodamiento_exitoso = serializers.SerializerMethodField()
    tiene_pago_mp = serializers.SerializerMethodField()
    monto_pendiente = serializers.SerializerMethodField()
    monto_pendiente_original = serializers.SerializerMethodField()
    descuento_aplicado = serializers.SerializerMethodField()
    pagado_completo = serializers.SerializerMethodField()
    elegible_credito_cancelacion = serializers.SerializerMethodField()
    monto_credito_cancelacion = serializers.SerializerMethodField()
    puede_reprogramar = serializers.SerializerMethodField()
    motivo_no_reprogramable = serializers.SerializerMethodField()
    reprogramacion_bloqueada_codigo = serializers.SerializerMethodField()
    reprogramaciones_mensuales_usadas = serializers.SerializerMethodField()
    reprogramaciones_mensuales_max = serializers.SerializerMethodField()
    reprogramaciones_mensuales_restantes = serializers.SerializerMethodField()
    fue_reprogramado = serializers.SerializerMethodField()
    ultimo_movimiento_reprogramacion = serializers.SerializerMethodField()
    cupon_racha_aplicado = serializers.SerializerMethodField()
    cupon_racha_codigo = serializers.SerializerMethodField()
    cupon_racha_descuento = serializers.SerializerMethodField()
    oferta_fidelizacion_aplicada = serializers.SerializerMethodField()
    oferta_fidelizacion_descuento = serializers.SerializerMethodField()

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
            "servicio_precio",
            "servicio_duracion",
            "categoria_nombre",
            "sala",
            "sala_nombre",
            "fecha_hora",
            "fecha_hora_fin",
            "fecha_hora_completado",
            "estado",
            "estado_display",
            "precio_final",
            "senia_pagada",
            "canal_reserva",
            "metodo_pago",
            "tipo_pago",
            "es_cliente_registrado",
            "walkin_nombre",
            "walkin_dni",
            "walkin_email",
            "walkin_telefono",
            "fecha_pago_registrado",
            "monto_pendiente",
            "monto_pendiente_original",
            "descuento_aplicado",
            "puede_cancelar",
            "tiene_pago_mp",
            "pagado_completo",
            "elegible_credito_cancelacion",
            "monto_credito_cancelacion",
            "puede_reprogramar",
            "motivo_no_reprogramable",
            "reprogramacion_bloqueada_codigo",
            "reprogramaciones_mensuales_usadas",
            "reprogramaciones_mensuales_max",
            "reprogramaciones_mensuales_restantes",
            "fue_reprogramado",
            "ultimo_movimiento_reprogramacion",
            "cupon_racha_aplicado",
            "cupon_racha_codigo",
            "cupon_racha_descuento",
            "oferta_fidelizacion_aplicada",
            "oferta_fidelizacion_descuento",
            "notas_cliente",
            "notas_empleado",
            "reacomodamiento_exitoso",
            "created_at",
            "updated_at",
        ]

    def get_puede_cancelar(self, obj):
        return obj.puede_cancelar()

    def _get_estado_reprogramacion(self, obj):
        estados_finales = ["completado", "cancelado", "no_asistio", "pendiente_manual", "oferta_enviada", "expirada"]
        if obj.estado in estados_finales:
            return {
                "puede_reprogramar": False,
                "codigo": f"estado_{obj.estado}",
                "usadas": 0,
                "limite": 1,
                "restantes": 0,
                "motivo": "Este turno no se puede reprogramar por su estado actual.",
            }

        try:
            from apps.turnos.services.reprogramacion_service import obtener_estado_limite_reprogramacion_cliente_servicio

            return obtener_estado_limite_reprogramacion_cliente_servicio(obj)
        except Exception:
            return {
                "puede_reprogramar": True,
                "codigo": "disponible",
                "usadas": 0,
                "limite": 1,
                "restantes": 1,
                "motivo": "",
            }

    def get_puede_reprogramar(self, obj):
        return self._get_estado_reprogramacion(obj)["puede_reprogramar"]

    def get_motivo_no_reprogramable(self, obj):
        estado = self._get_estado_reprogramacion(obj)
        return "" if estado["puede_reprogramar"] else estado["motivo"]

    def get_reprogramacion_bloqueada_codigo(self, obj):
        estado = self._get_estado_reprogramacion(obj)
        return None if estado["puede_reprogramar"] else estado["codigo"]

    def get_reprogramaciones_mensuales_usadas(self, obj):
        return self._get_estado_reprogramacion(obj).get("usadas", 0)

    def get_reprogramaciones_mensuales_max(self, obj):
        return self._get_estado_reprogramacion(obj).get("limite", 1)

    def get_reprogramaciones_mensuales_restantes(self, obj):
        return self._get_estado_reprogramacion(obj).get("restantes", 0)

    def get_reacomodamiento_exitoso(self, obj):
        from .models import LogReasignacion

        return LogReasignacion.objects.filter(
            turno_cancelado=obj, estado_final="aceptada"
        ).exists()

    def get_fue_reprogramado(self, obj):
        return obj.historial.filter(accion="Reprogramacion de turno").exists()

    def get_ultimo_movimiento_reprogramacion(self, obj):
        import re
        from datetime import datetime

        historial = obj.historial.filter(accion="Reprogramacion de turno").order_by("-created_at").first()
        if not historial:
            return None

        movimiento = {
            "created_at": historial.created_at,
            "observaciones": historial.observaciones or "",
            "tipo": "reprogramado",
        }

        match = re.search(
            r"de (\d{2}/\d{2}/\d{4} \d{2}:\d{2}) a (\d{2}/\d{2}/\d{4} \d{2}:\d{2})",
            historial.observaciones or "",
        )
        if match:
            try:
                anterior = datetime.strptime(match.group(1), "%d/%m/%Y %H:%M")
                nueva = datetime.strptime(match.group(2), "%d/%m/%Y %H:%M")
                movimiento["tipo"] = "adelantado" if nueva < anterior else "postergado"
                movimiento["fecha_anterior"] = match.group(1)
                movimiento["fecha_nueva"] = match.group(2)
            except Exception:
                pass

        return movimiento

    def get_tiene_pago_mp(self, obj):
        """Indica si el turno tiene un pago de Mercado Pago aprobado asociado."""
        try:
            return obj.pagos_mercadopago.filter(estado="approved").exists()
        except Exception:
            return False

    def _get_descuento_reacomodamiento(self, obj: Turno) -> Decimal:
        """Obtiene el monto de descuento aplicado por reacomodamiento (si lo hubo).

        Busca el último LogReasignacion aceptado donde este turno quedó como
        turno_cancelado (es decir, el turno final que ve el cliente).
        """

        from .models import LogReasignacion

        log = (
            LogReasignacion.objects.filter(turno_cancelado=obj, estado_final="aceptada")
            .order_by("-id")
            .first()
        )
        if log and log.monto_descuento is not None:
            return Decimal(log.monto_descuento)
        return Decimal("0.00")

    def get_monto_pendiente_original(self, obj: Turno) -> Decimal:
        """Monto que debería pagar en el local sin bonos.

        Usa el precio del servicio menos la seña pagada como referencia base.
        """

        precio_total = Decimal(obj.servicio.precio if obj.servicio else 0)
        senia = Decimal(obj.senia_pagada or 0)
        return Turno.calcular_pago_final(precio_total, Decimal("0.00"), senia)

    def get_monto_pendiente(self, obj: Turno) -> Decimal:
        """Monto actual pendiente a pagar en el local.

        - Si hubo reacomodamiento aceptado, aplica el descuento fijo.
        - Si existe precio_final, lo usa como valor principal.
        - En caso contrario usa el monto original sin bonos.
        """

        return calcular_monto_pendiente_turno(obj)

    def get_descuento_aplicado(self, obj: Turno) -> Decimal:
        """Diferencia entre el monto original y el actual (bono aplicado)."""

        original = self.get_monto_pendiente_original(obj)
        actual = self.get_monto_pendiente(obj)
        descuento = original - actual
        if descuento > 0:
            return descuento
        return Decimal("0.00")

    def get_pagado_completo(self, obj: Turno) -> bool:
        """Indica si el turno ya no tiene saldo pendiente.

        Se considera pagado completo cuando el monto pendiente calculado es
        cero o negativo (por seguridad se limita a cero en la lógica de
        negocio), lo que incluye los casos donde la seña + créditos cubren el
        100% del servicio.
        """

        try:
            pendiente = self.get_monto_pendiente(obj)
            return pendiente <= Decimal("0.00")
        except Exception:
            return False

    def _get_datos_credito_cancelacion(self, obj: Turno) -> tuple[bool, Decimal]:
        """Calcula si el turno genera crédito al cancelarse y el monto.

        Replica la lógica de `TurnoViewSet.destroy` para mostrarle al cliente
        información anticipada y evitar inconsistencias entre lo que se muestra
        y lo que realmente se acredita.
        """

        from django.utils import timezone
        from apps.authentication.models import ConfiguracionGlobal

        # Si directamente no puede cancelar, no hay crédito
        if not obj.puede_cancelar() or not obj.cliente:
            return False, Decimal("0.00")

        config_global = ConfiguracionGlobal.get_config()
        min_horas_credito_global = config_global.min_horas_cancelacion_credito
        min_horas_credito_servicio = max(
            24,
            int(getattr(obj.servicio, "horas_minimas_credito_cancelacion", 24) or 24),
        )
        min_horas_credito = max(min_horas_credito_global, min_horas_credito_servicio)

        horas_diferencia = (obj.fecha_hora - timezone.now()).total_seconds() / 3600

        if horas_diferencia < min_horas_credito:
            return False, Decimal("0.00")

        senia_pagada = Decimal(obj.senia_pagada or 0)
        precio_base = Decimal(obj.precio_final or obj.servicio.precio or 0)
        pago_completo = obj.resolver_tipo_pago() == "PAGO_COMPLETO"

        if pago_completo:
            monto_credito = precio_base
        else:
            monto_credito = senia_pagada

        monto_credito = monto_credito.quantize(Decimal("0.01"))
        if monto_credito <= 0:
            return False, Decimal("0.00")

        return True, monto_credito

    def get_elegible_credito_cancelacion(self, obj: Turno) -> bool:
        elegible, _ = self._get_datos_credito_cancelacion(obj)
        return elegible

    def get_monto_credito_cancelacion(self, obj: Turno) -> Decimal:
        _, monto = self._get_datos_credito_cancelacion(obj)
        return monto

    def _get_streak_coupon_used(self, obj: Turno):
        return obj.streak_coupons_used.filter(status="usado").order_by("-used_at").first()

    def get_cupon_racha_aplicado(self, obj: Turno) -> bool:
        return self._get_streak_coupon_used(obj) is not None

    def get_cupon_racha_codigo(self, obj: Turno) -> str:
        coupon = self._get_streak_coupon_used(obj)
        return coupon.code if coupon else ""

    def get_cupon_racha_descuento(self, obj: Turno) -> Decimal:
        coupon = self._get_streak_coupon_used(obj)
        return coupon.discount_amount if coupon else Decimal("0.00")

    def get_oferta_fidelizacion_aplicada(self, obj: Turno) -> bool:
        return obj.canal_reserva == "fidelizacion" or "Oferta de cliente olvidado" in (obj.notas_cliente or "")

    def get_oferta_fidelizacion_descuento(self, obj: Turno) -> Decimal:
        if not self.get_oferta_fidelizacion_aplicada(obj) or not obj.servicio:
            return Decimal("0.00")
        precio_servicio = Decimal(str(obj.servicio.precio or 0))
        precio_final = Decimal(str(obj.precio_final or 0))
        return max(Decimal("0.00"), precio_servicio - precio_final)


class TurnoDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para un turno específico"""

    cliente = ClienteListSerializer(read_only=True)
    empleado = EmpleadoListSerializer(read_only=True)
    servicio = ServicioSerializer(read_only=True)
    sala_nombre = serializers.CharField(source="sala.nombre", read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    fecha_hora_fin = serializers.DateTimeField(read_only=True)
    duracion = serializers.CharField(read_only=True)
    puede_cancelar = serializers.SerializerMethodField()
    elegible_credito_cancelacion = serializers.SerializerMethodField()
    monto_credito_cancelacion = serializers.SerializerMethodField()

    class Meta:
        model = Turno
        fields = "__all__"

    def get_puede_cancelar(self, obj):
        return obj.puede_cancelar()

    def get_elegible_credito_cancelacion(self, obj: Turno) -> bool:
        serializer = TurnoListSerializer(instance=obj, context=self.context)
        return serializer.get_elegible_credito_cancelacion(obj)

    def get_monto_credito_cancelacion(self, obj: Turno) -> Decimal:
        serializer = TurnoListSerializer(instance=obj, context=self.context)
        return serializer.get_monto_credito_cancelacion(obj)


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
            "senia_pagada",
            "canal_reserva",
            "metodo_pago",
            "tipo_pago",
            "es_cliente_registrado",
            "walkin_nombre",
            "walkin_dni",
            "walkin_email",
            "walkin_telefono",
            "fecha_pago_registrado",
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
        sala = servicio.categoria.sala if servicio.categoria else None

        if not sala:
            raise serializers.ValidationError(
                {"sala": "La categoría seleccionada no tiene sala asignada."}
            )

        # Verificar unique_together antes de otras validaciones
        turno_exacto = Turno.objects.filter(
            empleado=empleado, fecha_hora=fecha_hora
        ).exclude(id=self.instance.id if self.instance else None)

        if turno_exacto.exists():
            raise serializers.ValidationError(
                {
                    "fecha_hora": "Este horario ya está ocupado. Por favor selecciona otro horario."
                }
            )

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

        try:
            turno_tmp = Turno(servicio=servicio, fecha_hora=fecha_hora, sala=sala)
            turno_tmp.validar_capacidad_salas(fecha_hora=fecha_hora, servicio=servicio)
        except Exception as exc:
            mensaje = getattr(exc, "messages", None)
            detalle = mensaje[0] if mensaje else str(exc)
            raise serializers.ValidationError({"sala": detalle})

        return data

    def create(self, validated_data):
        # Establecer precio final si no se proporciona
        if not validated_data.get("precio_final"):
            validated_data["precio_final"] = validated_data["servicio"].precio

        # Definir canal por defecto para reservas creadas desde el flujo público
        if not validated_data.get("canal_reserva"):
            validated_data["canal_reserva"] = "web_cliente"

        servicio = validated_data.get("servicio")
        if servicio and servicio.categoria:
            validated_data["sala"] = servicio.categoria.sala

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
            "senia_pagada",
        ]

    def validate(self, data):
        servicio = self.instance.servicio if self.instance else None
        fecha_hora = data.get("fecha_hora")

        sala = servicio.categoria.sala if servicio and servicio.categoria else None

        if fecha_hora is not None:
            if not sala:
                raise serializers.ValidationError(
                    {"sala": "La categoría seleccionada no tiene sala asignada."}
                )
            try:
                self.instance.validar_capacidad_salas(
                    fecha_hora=fecha_hora, servicio=servicio
                )
            except Exception as exc:
                mensaje = getattr(exc, "messages", None)
                detalle = mensaje[0] if mensaje else str(exc)
                raise serializers.ValidationError({"sala": detalle})

        return data

    def validate_estado(self, value):
        """Validar transiciones de estado permitidas"""
        if self.instance:
            estado_actual = self.instance.estado

            # Definir transiciones válidas
            transiciones_validas = {
                "pendiente": ["confirmado", "cancelado", "pendiente_manual"],
                "confirmado": [
                    "en_proceso",
                    "cancelado",
                    "no_asistio",
                    "pendiente_manual",
                    "oferta_enviada",
                ],
                "pendiente_manual": ["pendiente", "confirmado", "cancelado"],
                "en_proceso": ["completado", "cancelado"],
                "completado": [],  # No se puede cambiar
                "cancelado": [],  # No se puede cambiar
                "no_asistio": [],  # No se puede cambiar
                "oferta_enviada": ["confirmado", "expirada"],
                "expirada": [],
            }

            if value != estado_actual and value not in transiciones_validas.get(
                estado_actual, []
            ):
                raise serializers.ValidationError(
                    f'No se puede cambiar de estado "{estado_actual}" a "{value}".'
                )

            if value == "completado" and value != estado_actual:
                pendiente = calcular_monto_pendiente_turno(self.instance)
                if pendiente > Decimal("0.00"):
                    raise serializers.ValidationError(
                        f"No se puede finalizar el turno: falta registrar un pago de ${pendiente}."
                    )

            # Restricción operativa de inicio deshabilitada en modo test.
            # En producción deberá volver a activarse para respetar fecha/hora programadas.

        return value


class ReprogramarTurnoSerializer(serializers.Serializer):
    """Serializer de entrada para reprogramación de turnos."""

    nueva_fecha_hora = serializers.DateTimeField(required=True)
    motivo = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    nuevo_empleado_id = serializers.IntegerField(required=False, allow_null=True)
    aceptar_penalidad_fuera_rango = serializers.BooleanField(required=False, default=False)
    permitir_sobreturno = serializers.BooleanField(required=False, default=False)


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
