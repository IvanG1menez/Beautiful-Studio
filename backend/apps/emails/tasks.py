"""Tareas asíncronas de Celery para emails."""

from celery import shared_task
from django.utils import timezone
from django.db.models import Count, Sum, Q
from datetime import timedelta, datetime
import logging

logger = logging.getLogger(__name__)


@shared_task(name="apps.emails.tasks.enviar_recordatorios_turnos")
def enviar_recordatorios_turnos():
    """
    Tarea programada para enviar recordatorios de turnos
    Se ejecuta diariamente a las 9:00 AM
    Envía recordatorios de turnos que ocurrirán en las próximas 24 horas
    """
    from apps.turnos.models import Turno
    from apps.emails.models import NotificacionConfig
    from apps.emails.services import EmailService

    logger.info("Iniciando envío de recordatorios de turnos...")

    try:
        # Calcular ventana de tiempo (próximas 24 horas)
        ahora = timezone.now()
        manana = ahora + timedelta(hours=24)

        # Obtener turnos confirmados en las próximas 24 horas
        turnos = Turno.objects.filter(
            fecha_hora__gte=ahora,
            fecha_hora__lte=manana,
            estado__in=["pendiente", "confirmado"],
        ).select_related("empleado__user", "cliente", "servicio")

        emails_enviados = 0
        emails_fallidos = 0

        for turno in turnos:
            # Verificar configuración del profesional
            config, _ = NotificacionConfig.objects.get_or_create(
                user=turno.empleado.user, defaults={"email_recordatorio_turno": True}
            )

            if config.email_recordatorio_turno:
                try:
                    if EmailService.enviar_email_recordatorio_turno(turno):
                        emails_enviados += 1
                    else:
                        emails_fallidos += 1
                except Exception as e:
                    logger.error(
                        f"Error enviando recordatorio para turno {turno.id}: {str(e)}"
                    )
                    emails_fallidos += 1

        logger.info(
            f"Recordatorios enviados: {emails_enviados}, fallidos: {emails_fallidos}"
        )

        return {
            "turnos_procesados": turnos.count(),
            "emails_enviados": emails_enviados,
            "emails_fallidos": emails_fallidos,
        }

    except Exception as e:
        logger.error(f"Error en tarea de recordatorios: {str(e)}")
        raise


@shared_task(name="apps.emails.tasks.enviar_reporte_diario_propietarios")
def enviar_reporte_diario_propietarios():
    """
    Tarea programada para enviar reporte diario a propietarios
    Se ejecuta diariamente a las 8:00 PM
    Incluye estadísticas del día: turnos, ingresos, nuevos clientes
    """
    from apps.turnos.models import Turno
    from apps.clientes.models import Cliente
    from apps.users.models import User
    from apps.emails.models import NotificacionConfig
    from apps.emails.services import EmailService

    logger.info("Iniciando envío de reporte diario...")

    try:
        # Calcular rango del día actual
        hoy = timezone.now().date()
        inicio_dia = timezone.make_aware(datetime.combine(hoy, datetime.min.time()))
        fin_dia = timezone.make_aware(datetime.combine(hoy, datetime.max.time()))

        # Estadísticas del día
        turnos_hoy = Turno.objects.filter(fecha_hora__range=(inicio_dia, fin_dia))

        turnos_completados = turnos_hoy.filter(estado="completado").count()
        turnos_cancelados = turnos_hoy.filter(estado="cancelado").count()
        turnos_pendientes = turnos_hoy.filter(
            estado__in=["pendiente", "confirmado"]
        ).count()

        # Calcular ingresos (turnos completados con precio)
        ingresos_totales = (
            turnos_hoy.filter(estado="completado").aggregate(total=Sum("precio_final"))[
                "total"
            ]
            or 0
        )

        # Si no hay precio_final, sumar el precio del servicio
        if ingresos_totales == 0:
            ingresos_totales = (
                turnos_hoy.filter(estado="completado").aggregate(
                    total=Sum("servicio__precio")
                )["total"]
                or 0
            )

        # Nuevos clientes del día
        nuevos_clientes = Cliente.objects.filter(
            user__created_at__range=(inicio_dia, fin_dia)
        ).count()

        # Preparar datos del reporte
        datos_reporte = {
            "turnos_completados": turnos_completados,
            "turnos_cancelados": turnos_cancelados,
            "turnos_pendientes": turnos_pendientes,
            "ingresos_totales": float(ingresos_totales),
            "nuevos_clientes": nuevos_clientes,
        }

        # Obtener propietarios con email de reporte activado
        propietarios = User.objects.filter(role="propietario")

        emails_enviados = 0
        for propietario in propietarios:
            config, _ = NotificacionConfig.objects.get_or_create(
                user=propietario, defaults={"email_reporte_diario": True}
            )

            if config.email_reporte_diario:
                try:
                    if EmailService.enviar_email_reporte_diario_propietario(
                        datos_reporte
                    ):
                        emails_enviados += 1
                except Exception as e:
                    logger.error(
                        f"Error enviando reporte a {propietario.email}: {str(e)}"
                    )

        logger.info(f"Reportes diarios enviados: {emails_enviados}")

        return {
            "propietarios_notificados": emails_enviados,
            "datos_reporte": datos_reporte,
        }

    except Exception as e:
        logger.error(f"Error en tarea de reporte diario: {str(e)}")
        raise


@shared_task(name="apps.emails.tasks.limpiar_notificaciones_antiguas")
def limpiar_notificaciones_antiguas(dias=90):
    """
    Tarea opcional para limpiar notificaciones antiguas
    Por defecto elimina notificaciones leídas con más de 90 días
    """
    from apps.emails.models import Notificacion

    logger.info(f"Limpiando notificaciones antiguas (>{dias} días)...")

    try:
        fecha_limite = timezone.now() - timedelta(days=dias)

        # Eliminar notificaciones leídas antiguas
        notificaciones_eliminadas = Notificacion.objects.filter(
            leida=True, leida_at__lt=fecha_limite
        ).delete()

        logger.info(f"Notificaciones eliminadas: {notificaciones_eliminadas[0]}")

        return {"notificaciones_eliminadas": notificaciones_eliminadas[0]}

    except Exception as e:
        logger.error(f"Error limpiando notificaciones: {str(e)}")
        raise


def _buscar_proximo_horario_disponible(empleado, servicio, dias_busqueda: int = 30):
    """Busca el próximo horario disponible para un empleado y servicio.

    Reutiliza la misma lógica básica que el endpoint de turnos disponibles,
    pero limitada a encontrar el primer hueco libre en los próximos
    ``dias_busqueda`` días. Si no encuentra disponibilidad, retorna ``None``.
    """

    from datetime import datetime as dt
    from apps.empleados.models import HorarioEmpleado
    from apps.turnos.models import Turno

    ahora = timezone.now()

    # Si el profesional no está disponible, no sugerimos horario
    if not getattr(empleado, "is_disponible", True):
        return None

    for offset in range(dias_busqueda + 1):
        fecha_obj = (ahora + timedelta(days=offset)).date()

        # Obtener día de la semana (0 = Lunes, 6 = Domingo)
        dia_semana = fecha_obj.weekday()

        # Obtener horarios del empleado para ese día
        horarios_dia = HorarioEmpleado.objects.filter(
            empleado=empleado, dia_semana=dia_semana, is_active=True
        ).order_by("hora_inicio")

        # Si no tiene horarios configurados en HorarioEmpleado, usar campos legacy
        if not horarios_dia.exists():
            dias_trabajo = getattr(empleado, "dias_trabajo", "") or ""
            if not dias_trabajo:
                continue

            dias_trabajo_list = dias_trabajo.split(",")
            dias_map = {"L": 0, "M": 1, "Mi": 2, "J": 3, "V": 4, "S": 5, "D": 6, "X": 2}

            dias_numericos = []
            for dia in dias_trabajo_list:
                dia = dia.strip()
                if dia in dias_map:
                    dias_numericos.append(dias_map[dia])

            if dia_semana not in dias_numericos:
                continue

            class HorarioLegacy:
                def __init__(self, hora_inicio, hora_fin):
                    self.hora_inicio = hora_inicio
                    self.hora_fin = hora_fin

            horarios_dia = [
                HorarioLegacy(empleado.horario_entrada, empleado.horario_salida)
            ]

        incremento = timedelta(minutes=30)

        # Turnos existentes del día para evitar solapamientos
        turnos_dia = list(
            Turno.objects.select_related("servicio").filter(
                empleado=empleado,
                fecha_hora__date=fecha_obj,
                estado__in=["pendiente", "confirmado", "en_proceso"],
            )
        )

        for horario_rango in horarios_dia:
            hora_actual = timezone.make_aware(
                dt.combine(fecha_obj, horario_rango.hora_inicio)
            )
            hora_fin = timezone.make_aware(
                dt.combine(fecha_obj, horario_rango.hora_fin)
            )

            while (
                hora_actual + timedelta(minutes=servicio.duracion_minutos) <= hora_fin
            ):
                hora_fin_turno = hora_actual + timedelta(
                    minutes=servicio.duracion_minutos
                )

                conflicto = False
                for turno_existente in turnos_dia:
                    if not turno_existente.fecha_hora or not turno_existente.servicio:
                        continue
                    inicio_existente = turno_existente.fecha_hora
                    fin_existente = inicio_existente + timedelta(
                        minutes=turno_existente.servicio.duracion_minutos
                    )
                    if (
                        hora_actual < fin_existente
                        and hora_fin_turno > inicio_existente
                    ):
                        conflicto = True
                        break

                if not conflicto and hora_actual > ahora:
                    return hora_actual

                hora_actual += incremento

    return None


@shared_task(name="apps.emails.tasks.enviar_emails_fidelizacion_clientes")
def enviar_emails_fidelizacion_clientes(dias_por_defecto: int = 30):
    """Tarea diaria para enviar emails de fidelización a clientes inactivos.

    La inactividad se calcula por cliente + servicio + profesional usando la
    frecuencia de recurrencia configurada en el modelo Servicio. Se envía un
    único email por ciclo (desde el último turno completado hasta que vuelva
    a atenderse ese servicio con ese profesional), registrado mediante el
    modelo Notificacion con tipo ``fidelizacion``.
    """

    from decimal import Decimal

    from apps.clientes.models import Billetera
    from apps.empleados.models import EmpleadoServicio
    from apps.emails.models import Notificacion
    from apps.emails.services import EmailService
    from apps.servicios.models import Servicio
    from apps.turnos.models import Turno

    logger.info("Iniciando tarea de fidelización de clientes...")

    ahora = timezone.now()

    servicios = Servicio.objects.filter(is_active=True)

    total_candidatos = 0
    emails_enviados = 0
    emails_fallidos = 0

    for servicio in servicios:
        frecuencia_dias = servicio.frecuencia_recurrencia_dias or dias_por_defecto
        if frecuencia_dias <= 0:
            frecuencia_dias = dias_por_defecto

        cutoff_date = ahora - timedelta(days=frecuencia_dias)

        # Turnos completados para este servicio
        turnos_servicio = (
            Turno.objects.filter(servicio=servicio, estado="completado")
            .select_related("cliente__user", "empleado__user")
            .order_by("cliente_id", "empleado_id", "-fecha_hora")
        )

        visitados = set()

        for turno in turnos_servicio:
            clave = (turno.cliente_id, turno.empleado_id)
            if clave in visitados:
                continue
            visitados.add(clave)

            fecha_ref = turno.fecha_hora_completado or turno.fecha_hora
            if not fecha_ref or fecha_ref > cutoff_date:
                continue

            cliente = turno.cliente
            empleado = turno.empleado

            # Validaciones de profesional y relación con el servicio
            if not empleado or not getattr(empleado, "user", None):
                continue
            if not empleado.user.is_active:
                continue
            if not EmpleadoServicio.objects.filter(
                empleado=empleado, servicio=servicio
            ).exists():
                continue

            # Verificar que no haya ya una notificación de fidelización para este ciclo
            if Notificacion.objects.filter(
                usuario=cliente.user,
                tipo="fidelizacion",
                data__servicio_id=servicio.id,
                data__empleado_id=empleado.id,
                created_at__gte=fecha_ref,
            ).exists():
                continue

            # Buscar próximo horario disponible; si no hay, no enviamos email
            fecha_sugerida = _buscar_proximo_horario_disponible(empleado, servicio)
            if not fecha_sugerida:
                continue

            total_candidatos += 1

            # Determinar saldo de billetera
            saldo = Decimal("0.00")
            tiene_saldo = False
            try:
                billetera = Billetera.objects.get(cliente=cliente)
                saldo = billetera.saldo
                tiene_saldo = saldo > 0
            except Billetera.DoesNotExist:
                tiene_saldo = False

            # Construir URL de reserva para flujo específico de fidelización
            # sin login automático por token.
            # Agregamos el parámetro "beneficio" para que el frontend pueda
            # distinguir entre clientes con saldo y con descuento y redirigir
            # al flujo correspondiente (wizard normal vs pantalla de pago
            # con descuento).
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

            try:
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
                    Notificacion.objects.create(
                        usuario=cliente.user,
                        tipo="fidelizacion",
                        titulo="Recordatorio de servicio",
                        mensaje=f"Fidelización para {servicio.nombre} con {empleado.nombre_completo}",
                        data={
                            "servicio_id": servicio.id,
                            "empleado_id": empleado.id,
                            "fecha_ultimo_turno": fecha_ref.isoformat(),
                            "fecha_sugerida": fecha_sugerida.isoformat(),
                            "tipo_email": tipo_email,
                        },
                    )
                else:
                    emails_fallidos += 1

            except Exception as e:
                logger.error(
                    f"Error enviando email de fidelización para cliente {cliente.id}: {str(e)}"
                )
                emails_fallidos += 1

    logger.info(
        "Fidelización finalizada - candidatos: %s, enviados: %s, fallidos: %s",
        total_candidatos,
        emails_enviados,
        emails_fallidos,
    )

    return {
        "candidatos": total_candidatos,
        "emails_enviados": emails_enviados,
        "emails_fallidos": emails_fallidos,
    }
