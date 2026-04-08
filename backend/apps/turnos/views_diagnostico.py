"""
Vistas de diagnóstico para testing manual de procesos automáticos
Solo accesible para usuarios con rol 'propietario'
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.db.models import Max, Count
from django.conf import settings
from decimal import Decimal
import logging

from .models import Turno, HistorialTurno, LogReasignacion
from apps.clientes.models import Cliente, Billetera
from apps.authentication.models import ConfiguracionGlobal
from apps.servicios.models import Servicio
from apps.turnos.services.reacomodamiento_service import iniciar_reacomodamiento

from apps.turnos.services.reasignacion_service import expirar_oferta_reasignacion
from apps.emails.services.email_service import EmailService
from apps.emails.models import Notificacion
from apps.empleados.models import EmpleadoServicio
from apps.emails.tasks import _buscar_proximo_horario_disponible

logger = logging.getLogger(__name__)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def diagnostico_optimizacion_agenda(request):
    """
    Endpoint de diagnóstico para triggear manualmente el proceso de optimización de agenda.

    Flujo:
    1. Recibe ID de un turno
    2. Cancela el turno
    3. Acredita billetera si aplica
    4. Ejecuta proceso_2 (iniciar_reacomodamiento)

    Body params:
    - turno_id: ID del turno a cancelar

    Returns:
    - Resultado del proceso con logs detallados
    """

    # Verificar que el usuario sea propietario
    if request.user.role != "propietario":
        return Response(
            {
                "error": "Solo el propietario puede acceder a herramientas de diagnóstico"
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    turno_id = request.data.get("turno_id")

    if not turno_id:
        return Response(
            {"error": "Se requiere el campo 'turno_id'"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        turno = Turno.objects.select_related(
            "servicio", "cliente", "empleado__user"
        ).get(id=turno_id)
    except Turno.DoesNotExist:
        return Response(
            {"error": f"Turno con ID {turno_id} no encontrado"},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Verificar que el turno pueda ser cancelado
    if not turno.puede_cancelar():
        return Response(
            {
                "error": "Este turno no puede ser cancelado (ya está cancelado, completado o en el pasado)"
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    resultado = {
        "turno_id": turno.id,
        "turno_info": {
            "servicio": turno.servicio.nombre if turno.servicio else "Sin servicio",
            "cliente": (
                turno.cliente.nombre_completo if turno.cliente else "Sin cliente"
            ),
            "empleado": (
                turno.empleado.user.get_full_name()
                if turno.empleado
                else "Sin empleado"
            ),
            "fecha_hora": turno.fecha_hora.isoformat() if turno.fecha_hora else None,
            "precio": float(
                turno.precio_final or (turno.servicio.precio if turno.servicio else 0)
            ),
        },
        "logs": [],
    }

    # PASO 1: Cancelar turno
    try:
        estado_anterior = turno.estado
        turno.estado = "cancelado"
        turno.save()

        resultado["logs"].append(
            {
                "paso": 1,
                "accion": "Cancelación de turno",
                "resultado": "exitoso",
                "detalle": f"Turno {turno.id} cancelado (estado anterior: {estado_anterior})",
            }
        )

        # Registrar en historial
        HistorialTurno.objects.create(
            turno=turno,
            usuario=request.user,
            accion="Cancelación de turno (diagnóstico)",
            estado_anterior=estado_anterior,
            estado_nuevo="cancelado",
            observaciones="Cancelado manualmente desde herramientas de diagnóstico",
        )

    except Exception as e:
        resultado["logs"].append(
            {
                "paso": 1,
                "accion": "Cancelación de turno",
                "resultado": "error",
                "detalle": str(e),
            }
        )
        return Response(resultado, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # PASO 2: Acreditar billetera (si aplica)
    credito_aplicado = False
    monto_credito = 0

    try:
        config_global = ConfiguracionGlobal.get_config()
        min_horas_credito = config_global.min_horas_cancelacion_credito

        # Calcular diferencia de horas entre ahora y el turno
        if turno.fecha_hora:
            horas_diferencia = (
                turno.fecha_hora - timezone.now()
            ).total_seconds() / 3600

            if horas_diferencia > min_horas_credito and turno.cliente:
                # Obtener o crear billetera
                billetera, created = Billetera.objects.get_or_create(
                    cliente=turno.cliente, defaults={"saldo": Decimal("0.00")}
                )

                # Calcular monto a acreditar: solo la seña pagada
                monto_credito = turno.senia_pagada or Decimal("0.00")

                # Agregar crédito
                billetera.agregar_saldo(
                    monto=monto_credito,
                    motivo=f"Cancelación anticipada (diagnóstico) del turno #{turno.id} - {turno.servicio.nombre}",
                )

                # Actualizar movimiento con referencia al turno
                ultimo_movimiento = billetera.movimientos.first()
                if ultimo_movimiento:
                    ultimo_movimiento.turno = turno
                    ultimo_movimiento.save()

                credito_aplicado = True

                resultado["logs"].append(
                    {
                        "paso": 2,
                        "accion": "Acreditación de billetera",
                        "resultado": "exitoso",
                        "detalle": f"Crédito de ${monto_credito} aplicado al cliente {turno.cliente.nombre_completo}",
                    }
                )
            else:
                motivo = (
                    "Sin cliente asociado"
                    if not turno.cliente
                    else f"Menos de {min_horas_credito}hs de anticipación"
                )
                resultado["logs"].append(
                    {
                        "paso": 2,
                        "accion": "Acreditación de billetera",
                        "resultado": "no_aplica",
                        "detalle": f"Crédito no aplicado: {motivo}",
                    }
                )
        else:
            resultado["logs"].append(
                {
                    "paso": 2,
                    "accion": "Acreditación de billetera",
                    "resultado": "no_aplica",
                    "detalle": "Turno sin fecha/hora definida",
                }
            )

    except Exception as e:
        resultado["logs"].append(
            {
                "paso": 2,
                "accion": "Acreditación de billetera",
                "resultado": "error",
                "detalle": str(e),
            }
        )

    # PASO 3: Ejecutar proceso_2 (reacomodamiento)
    try:
        if turno.servicio and turno.servicio.permite_reacomodamiento:
            # Evitar doble disparo: al cancelar ya se dispara la signal automática.
            log_pendiente = (
                LogReasignacion.objects.select_related("turno_ofrecido__cliente")
                .filter(turno_cancelado=turno, estado_final__isnull=True)
                .order_by("-fecha_envio")
                .first()
            )

            if log_pendiente:
                turno_candidato = log_pendiente.turno_ofrecido
                resultado["logs"].append(
                    {
                        "paso": 3,
                        "accion": "Proceso 2 - Optimización de agenda",
                        "resultado": "exitoso",
                        "detalle": f"Oferta ya generada automáticamente para turno #{turno_candidato.id if turno_candidato else 'N/A'}",
                    }
                )
                resultado["proceso_2"] = {
                    "status": "propuesta_enviada",
                    "turno_candidato_id": (
                        turno_candidato.id if turno_candidato else None
                    ),
                    "cliente_contactado": (
                        turno_candidato.cliente.nombre_completo
                        if turno_candidato and turno_candidato.cliente
                        else None
                    ),
                }
            else:
                resultado_proceso2 = iniciar_reacomodamiento(turno.id)

                if resultado_proceso2.get("status") == "propuesta_enviada":
                    turno_candidato_id = resultado_proceso2.get("turno_id")
                    turno_candidato = Turno.objects.select_related("cliente").get(
                        id=turno_candidato_id
                    )

                    resultado["logs"].append(
                        {
                            "paso": 3,
                            "accion": "Proceso 2 - Optimización de agenda",
                            "resultado": "exitoso",
                            "detalle": f"Propuesta enviada al turno #{turno_candidato_id} (cliente: {turno_candidato.cliente.nombre_completo if turno_candidato.cliente else 'N/A'})",
                        }
                    )
                    resultado["proceso_2"] = {
                        "status": "propuesta_enviada",
                        "turno_candidato_id": turno_candidato_id,
                        "cliente_contactado": (
                            turno_candidato.cliente.nombre_completo
                            if turno_candidato.cliente
                            else None
                        ),
                    }
                else:
                    status_map = {
                        "sin_candidatos": "No se encontraron candidatos para rellenar el hueco",
                        "turno_fuera_de_ventana": "Turno ya pasó o está muy cerca",
                        "email_fallido": "Error al enviar email al candidato",
                        "servicio_sin_reacomodamiento": "Servicio no permite reacomodamiento",
                    }
                    motivo = status_map.get(
                        resultado_proceso2.get("status"), "Motivo desconocido"
                    )

                    resultado["logs"].append(
                        {
                            "paso": 3,
                            "accion": "Proceso 2 - Optimización de agenda",
                            "resultado": "no_aplica",
                            "detalle": motivo,
                        }
                    )
                    resultado["proceso_2"] = {
                        "status": resultado_proceso2.get("status"),
                        "motivo": motivo,
                    }
        else:
            resultado["logs"].append(
                {
                    "paso": 3,
                    "accion": "Proceso 2 - Optimización de agenda",
                    "resultado": "no_aplica",
                    "detalle": "Servicio no permite reacomodamiento",
                }
            )
            resultado["proceso_2"] = {
                "status": "servicio_sin_reacomodamiento",
                "motivo": "Este servicio no tiene habilitado el reacomodamiento automático",
            }

    except Exception as e:
        resultado["logs"].append(
            {
                "paso": 3,
                "accion": "Proceso 2 - Optimización de agenda",
                "resultado": "error",
                "detalle": str(e),
            }
        )
        resultado["proceso_2"] = {"status": "error", "detalle": str(e)}

    resultado["credito_aplicado"] = credito_aplicado
    resultado["monto_credito"] = float(monto_credito) if monto_credito else 0

    return Response(resultado, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def diagnostico_fidelizacion_clientes(request):
    """
    Endpoint de diagnóstico para triggear manualmente el proceso de fidelización de clientes.

    Flujo:
    1. Busca todos los clientes que cumplen la condición de recurrencia (inactivos)
    2. Envía ofertas/invitaciones a cada uno

    Body params (opcionales):
    - dias_inactividad: Filtro manual de días de inactividad (sobrescribe lógica automática)

    Returns:
    - Lista de clientes contactados y resultado
    """

    # Verificar que el usuario sea propietario
    if request.user.role != "propietario":
        return Response(
            {
                "error": "Solo el propietario puede acceder a herramientas de diagnóstico"
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    # Obtener configuración global
    config_global = ConfiguracionGlobal.get_config()

    # Obtener parámetros
    dias_inactividad_filtro = request.data.get("dias_inactividad")
    # En diagnóstico siempre enviamos los emails reales, sin modo simulación manual
    enviar_emails = True

    logger.info(
        "[DIAGNÓSTICO FIDELIZACIÓN] llamado con dias_inactividad=%s (emails SIEMPRE enviados)",
        dias_inactividad_filtro,
    )

    if dias_inactividad_filtro:
        dias_inactividad_filtro = int(dias_inactividad_filtro)

    # PASO 1: Identificar clientes inactivos (lógica de oportunidades)
    clientes_con_turnos = (
        Turno.objects.filter(cliente__isnull=False)
        .values("cliente")
        .annotate(ultimo_turno=Max("fecha_hora"), total_turnos=Count("id"))
    )

    clientes_candidatos = []

    for cliente_data in clientes_con_turnos:
        try:
            cliente = Cliente.objects.get(id=cliente_data["cliente"])

            # Calcular días de inactividad
            dias_sin_turno = (timezone.now() - cliente_data["ultimo_turno"]).days

            # Obtener servicio más frecuente del cliente
            servicio_mas_frecuente = (
                Turno.objects.filter(cliente=cliente)
                .values(
                    "servicio__id",
                    "servicio__nombre",
                    "servicio__precio",
                    "servicio__frecuencia_recurrencia_dias",
                )
                .annotate(cantidad=Count("id"))
                .order_by("-cantidad")
                .first()
            )

            # Determinar umbral de inactividad
            if dias_inactividad_filtro is not None:
                umbral_dias = dias_inactividad_filtro
            elif (
                servicio_mas_frecuente
                and servicio_mas_frecuente["servicio__frecuencia_recurrencia_dias"] > 0
            ):
                umbral_dias = servicio_mas_frecuente[
                    "servicio__frecuencia_recurrencia_dias"
                ]
            else:
                umbral_dias = config_global.margen_fidelizacion_dias

            # Solo incluir si supera el umbral
            if dias_sin_turno >= umbral_dias:
                servicio_obj = None
                if servicio_mas_frecuente:
                    try:
                        servicio_obj = Servicio.objects.get(
                            id=servicio_mas_frecuente["servicio__id"]
                        )
                    except Servicio.DoesNotExist:
                        pass

                clientes_candidatos.append(
                    {
                        "cliente": cliente,
                        "servicio": servicio_obj,
                        "dias_sin_turno": dias_sin_turno,
                        "umbral_usado": umbral_dias,
                    }
                )

        except Cliente.DoesNotExist:
            continue

    # PASO 2: Enviar invitaciones (si está habilitado)
    resultados = []
    emails_enviados = 0
    emails_fallidos = 0

    descuento_pct = float(config_global.descuento_fidelizacion_pct)

    for candidato in clientes_candidatos:
        cliente = candidato["cliente"]
        servicio = candidato["servicio"]

        # Obtener saldo de billetera para mostrar en diagnóstico
        saldo = Decimal("0.00")
        tiene_saldo = False
        try:
            billetera = Billetera.objects.get(cliente=cliente)
            saldo = billetera.saldo
            tiene_saldo = saldo > 0
        except Billetera.DoesNotExist:
            tiene_saldo = False

        resultado_cliente = {
            "cliente_id": cliente.id,
            "nombre": cliente.nombre_completo,
            "email": cliente.user.email,
            "dias_sin_turno": candidato["dias_sin_turno"],
            "umbral_usado": candidato["umbral_usado"],
            "servicio_propuesto": (
                {
                    "id": servicio.id,
                    "nombre": servicio.nombre,
                    "precio_original": float(servicio.precio),
                    "precio_con_descuento": float(servicio.precio)
                    * (1 - descuento_pct / 100),
                }
                if servicio
                else None
            ),
            "saldo_billetera": float(saldo),
            "tiene_saldo": tiene_saldo,
        }

        if enviar_emails:
            try:
                # Validar que haya servicio asociado
                if not servicio:
                    resultado_cliente["email_enviado"] = False
                    resultado_cliente["email_status"] = "simulado"
                    resultado_cliente["email_error"] = (
                        "Cliente sin servicio asociado para fidelización"
                    )
                else:
                    # Buscar el último turno completado de este cliente para el servicio
                    turno_ref = (
                        Turno.objects.filter(
                            cliente=cliente,
                            servicio=servicio,
                            estado="completado",
                        )
                        .select_related("empleado__user")
                        .order_by("-fecha_hora")
                        .first()
                    )

                    if not turno_ref or not turno_ref.empleado:
                        resultado_cliente["email_enviado"] = False
                        resultado_cliente["email_status"] = "simulado"
                        resultado_cliente["email_error"] = (
                            "Sin profesional asociado para fidelización"
                        )
                    else:
                        empleado = turno_ref.empleado
                        fecha_ref = (
                            turno_ref.fecha_hora_completado or turno_ref.fecha_hora
                        )

                        # Validaciones básicas del profesional
                        if (
                            not getattr(empleado, "user", None)
                            or not empleado.user.is_active
                        ):
                            resultado_cliente["email_enviado"] = False
                            resultado_cliente["email_status"] = "simulado"
                            resultado_cliente["email_error"] = (
                                "Profesional inactivo o sin usuario"
                            )
                        elif not EmpleadoServicio.objects.filter(
                            empleado=empleado, servicio=servicio
                        ).exists():
                            resultado_cliente["email_enviado"] = False
                            resultado_cliente["email_status"] = "simulado"
                            resultado_cliente["email_error"] = (
                                "Profesional no realiza este servicio"
                            )
                        elif Notificacion.objects.filter(
                            usuario=cliente.user,
                            tipo="fidelizacion",
                            data__servicio_id=servicio.id,
                            data__empleado_id=empleado.id,
                            created_at__gte=fecha_ref,
                        ).exists():
                            # Ya se envió una notificación en este ciclo
                            resultado_cliente["email_enviado"] = False
                            resultado_cliente["email_status"] = "simulado"
                            resultado_cliente["email_error"] = (
                                "Ya se envió una notificación en este ciclo"
                            )
                        else:
                            # Buscar próximo horario disponible
                            fecha_sugerida = _buscar_proximo_horario_disponible(
                                empleado, servicio
                            )

                            if not fecha_sugerida:
                                resultado_cliente["email_enviado"] = False
                                resultado_cliente["email_status"] = "simulado"
                                resultado_cliente["email_error"] = (
                                    "Sin horarios disponibles para sugerir"
                                )
                            else:
                                # Determinar saldo de billetera
                                saldo = Decimal("0.00")
                                tiene_saldo = False
                                try:
                                    billetera = Billetera.objects.get(cliente=cliente)
                                    saldo = billetera.saldo
                                    tiene_saldo = saldo > 0
                                except Billetera.DoesNotExist:
                                    tiene_saldo = False

                                # Construir URL de reserva específica para fidelización
                                # sin login automático por token.
                                # Igual que en la tarea Celery, agregamos el
                                # parámetro "beneficio" para que el frontend
                                # redirija correctamente al flujo de descuento
                                # o al wizard normal.
                                beneficio = "saldo" if tiene_saldo else "descuento"

                                base_url = (
                                    getattr(settings, "FRONTEND_URL", None)
                                    or getattr(settings, "BACKEND_URL", None)
                                    or "http://localhost:3000"
                                )
                                url_reserva = (
                                    f"{base_url}/fidelizacion/confirmar?beneficio={beneficio}&cliente={cliente.id}"
                                    f"&servicio={servicio.id}&empleado={empleado.id}"
                                    f"&fecha={fecha_sugerida.date().isoformat()}"
                                    f"&hora={fecha_sugerida.strftime('%H:%M')}"
                                )

                                logger.info(
                                    "[DIAGNÓSTICO FIDELIZACIÓN] candidato id=%s, email=%s, tiene_saldo=%s, url=%s",
                                    cliente.id,
                                    cliente.user.email,
                                    tiene_saldo,
                                    url_reserva,
                                )

                                if tiene_saldo:
                                    enviado = EmailService.enviar_email_fidelizacion_con_saldo(
                                        cliente=cliente,
                                        servicio=servicio,
                                        empleado=empleado,
                                        fecha_sugerida=fecha_sugerida,
                                        saldo_disponible=saldo,
                                        url_reserva=url_reserva,
                                    )
                                    tipo_email = "con_saldo"
                                else:
                                    enviado = EmailService.enviar_email_fidelizacion_sin_saldo(
                                        cliente=cliente,
                                        servicio=servicio,
                                        empleado=empleado,
                                        fecha_sugerida=fecha_sugerida,
                                        url_reserva=url_reserva,
                                    )
                                    tipo_email = "sin_saldo"

                                if enviado:
                                    emails_enviados += 1
                                    resultado_cliente["email_enviado"] = True
                                    resultado_cliente["email_status"] = "exitoso"

                                    Notificacion.objects.create(
                                        usuario=cliente.user,
                                        tipo="fidelizacion",
                                        titulo="Recordatorio de servicio",
                                        mensaje=(
                                            f"Fidelización para {servicio.nombre} "
                                            f"con {empleado.nombre_completo}"
                                        ),
                                        data={
                                            "servicio_id": servicio.id,
                                            "empleado_id": empleado.id,
                                            "fecha_ultimo_turno": (
                                                fecha_ref.isoformat()
                                                if fecha_ref
                                                else None
                                            ),
                                            "fecha_sugerida": fecha_sugerida.isoformat(),
                                            "tipo_email": tipo_email,
                                            "origen": "diagnostico",
                                        },
                                    )
                                else:
                                    emails_fallidos += 1
                                    resultado_cliente["email_enviado"] = False
                                    resultado_cliente["email_status"] = "error"
                                    resultado_cliente["email_error"] = (
                                        "Fallo al enviar el email"
                                    )

            except Exception as e:
                resultado_cliente["email_enviado"] = False
                resultado_cliente["email_status"] = "error"
                resultado_cliente["email_error"] = str(e)
                emails_fallidos += 1
                logger.error(
                    "[DIAGNÓSTICO FIDELIZACIÓN] Error enviando email a %s: %s",
                    cliente.user.email,
                    str(e),
                )
        else:
            resultado_cliente["email_enviado"] = False
            resultado_cliente["email_status"] = "simulado"

        resultados.append(resultado_cliente)

    emails_simulados = len(
        [r for r in resultados if r.get("email_status") == "simulado"]
    )

    return Response(
        {
            "mensaje": f"Proceso de fidelización ejecutado: {len(clientes_candidatos)} candidatos identificados",
            "configuracion": {
                "dias_inactividad_filtro": dias_inactividad_filtro,
                "usa_filtro_manual": dias_inactividad_filtro is not None,
                "margen_global": config_global.margen_fidelizacion_dias,
                "descuento_fidelizacion_pct": descuento_pct,
                "enviar_emails": enviar_emails,
            },
            "resumen": {
                "total_candidatos": len(clientes_candidatos),
                "emails_enviados": emails_enviados,
                "emails_fallidos": emails_fallidos,
                "emails_simulados": emails_simulados,
            },
            "resultados": resultados,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def diagnostico_simular_no_respuesta(request):
    """
    Endpoint de diagnóstico para simular que un cliente NO respondió a una oferta de reacomodamiento.
    Fuerza la expiración inmediata de la oferta y pasa al siguiente candidato.

    Body params:
    - turno_id: ID del turno que tiene una oferta pendiente

    Returns:
    - Resultado del proceso con logs detallados
    """

    # Verificar que el usuario sea propietario
    if request.user.role != "propietario":
        return Response(
            {
                "error": "Solo el propietario puede acceder a herramientas de diagnóstico"
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    turno_id = request.data.get("turno_id")

    if not turno_id:
        return Response(
            {"error": "Se requiere el campo 'turno_id'"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        turno = Turno.objects.select_related("cliente", "servicio").get(id=turno_id)
    except Turno.DoesNotExist:
        return Response(
            {"error": f"Turno con ID {turno_id} no encontrado"},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Buscar el log de reasignación asociado a este turno
    try:
        log_reasignacion = (
            LogReasignacion.objects.filter(
                turno_ofrecido_id=turno.id,
                estado_final__isnull=True,  # Solo ofertas pendientes
            )
            .select_related(
                "turno_cancelado",
                "turno_cancelado__servicio",
                "turno_cancelado__empleado__user",
            )
            .latest("fecha_envio")
        )
    except LogReasignacion.DoesNotExist:
        return Response(
            {"error": f"No se encontró una oferta pendiente para el turno {turno_id}"},
            status=status.HTTP_404_NOT_FOUND,
        )

    resultado = {
        "turno_id": turno.id,
        "turno_info": {
            "cliente": (
                turno.cliente.nombre_completo if turno.cliente else "Sin cliente"
            ),
            "servicio": turno.servicio.nombre if turno.servicio else "Sin servicio",
            "fecha_hora": turno.fecha_hora.isoformat() if turno.fecha_hora else None,
            "estado_original": turno.estado,
        },
        "log_id": log_reasignacion.id,
        "logs": [],
    }

    # PASO 1: Forzar expiración de la oferta
    try:
        # Actualizar el expires_at a ahora para forzar la expiración
        log_reasignacion.expires_at = timezone.now() - timezone.timedelta(seconds=1)
        log_reasignacion.save(update_fields=["expires_at"])

        resultado["logs"].append(
            {
                "paso": 1,
                "accion": "Forzar expiración de oferta",
                "resultado": "exitoso",
                "detalle": f"Oferta del turno #{turno.id} forzada a expirar",
            }
        )

    except Exception as e:
        resultado["logs"].append(
            {
                "paso": 1,
                "accion": "Forzar expiración de oferta",
                "resultado": "error",
                "detalle": str(e),
            }
        )
        return Response(resultado, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # PASO 2: Ejecutar la lógica de expiración
    try:
        resultado_expiracion = expirar_oferta_reasignacion(log_reasignacion.id)

        if resultado_expiracion.get("status") == "expirada":
            resultado["logs"].append(
                {
                    "paso": 2,
                    "accion": "Ejecutar lógica de expiración",
                    "resultado": "exitoso",
                    "detalle": f"Oferta expirada exitosamente. Estado del turno: expirada",
                }
            )

            # PASO 3: Buscar si se envió oferta al siguiente candidato
            siguiente_log = (
                LogReasignacion.objects.filter(
                    turno_cancelado_id=log_reasignacion.turno_cancelado_id,
                    estado_final__isnull=True,
                    fecha_envio__gt=log_reasignacion.fecha_envio,
                )
                .select_related("turno_ofrecido__cliente")
                .first()
            )

            if siguiente_log:
                resultado["logs"].append(
                    {
                        "paso": 3,
                        "accion": "Buscar siguiente candidato",
                        "resultado": "exitoso",
                        "detalle": f'Oferta enviada al turno #{siguiente_log.turno_ofrecido_id} (cliente: {siguiente_log.turno_ofrecido.cliente.nombre_completo if siguiente_log.turno_ofrecido.cliente else "N/A"})',
                    }
                )
                resultado["siguiente_candidato"] = {
                    "turno_id": siguiente_log.turno_ofrecido_id,
                    "cliente": (
                        siguiente_log.turno_ofrecido.cliente.nombre_completo
                        if siguiente_log.turno_ofrecido.cliente
                        else None
                    ),
                    "log_id": siguiente_log.id,
                }
            else:
                resultado["logs"].append(
                    {
                        "paso": 3,
                        "accion": "Buscar siguiente candidato",
                        "resultado": "no_aplica",
                        "detalle": "No se encontraron más candidatos para esta cancelación",
                    }
                )
                resultado["siguiente_candidato"] = None

        else:
            resultado["logs"].append(
                {
                    "paso": 2,
                    "accion": "Ejecutar lógica de expiración",
                    "resultado": "no_aplica",
                    "detalle": f'Estado de expiración: {resultado_expiracion.get("status")}',
                }
            )

    except Exception as e:
        resultado["logs"].append(
            {
                "paso": 2,
                "accion": "Ejecutar lógica de expiración",
                "resultado": "error",
                "detalle": str(e),
            }
        )
        logger.error(f"Error en expiración de oferta: {str(e)}")
        return Response(resultado, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response(resultado, status=status.HTTP_200_OK)
