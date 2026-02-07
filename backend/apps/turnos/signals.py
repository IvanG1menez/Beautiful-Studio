"""
Signals para la app de turnos
Maneja el envío de notificaciones y emails cuando ocurren eventos en los turnos
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
from .models import Turno
from apps.emails.models import Notificacion, NotificacionConfig
from apps.emails.services import EmailService
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Turno)
def manejar_creacion_turno(sender, instance, created, **kwargs):
    """
    Signal que se ejecuta cuando se crea un nuevo turno
    Envía notificaciones y emails al profesional y propietario
    """
    if created:
        try:
            # Crear notificación para el profesional
            # Obtener o crear configuración de notificaciones
            config_profesional, _ = NotificacionConfig.objects.get_or_create(
                user=instance.empleado.user,
                defaults={
                    "notificar_solicitud_turno": True,
                    "email_solicitud_turno": True,
                },
            )

            if config_profesional.notificar_solicitud_turno:
                Notificacion.objects.create(
                    usuario=instance.empleado.user,
                    tipo="solicitud_turno",
                    titulo="Nuevo turno asignado",
                    mensaje=f"Se te ha asignado un nuevo turno con {instance.cliente.nombre_completo} "
                    f"para el servicio {instance.servicio.nombre} "
                    f'el {instance.fecha_hora.strftime("%d/%m/%Y a las %H:%M")}',
                    data={
                        "turno_id": instance.id,
                        "cliente": instance.cliente.nombre_completo,
                        "servicio": instance.servicio.nombre,
                        "fecha_hora": instance.fecha_hora.isoformat(),
                    },
                )

                # Enviar email al profesional si está configurado
                if config_profesional.email_solicitud_turno:
                    logger.info(
                        f"Enviando email al profesional {instance.empleado.user.email}"
                    )
                    resultado = EmailService.enviar_email_nuevo_turno_profesional(
                        instance
                    )
                    logger.info(f"Resultado envío email profesional: {resultado}")
                    # Delay para evitar límite de Mailtrap
                    import time

                    time.sleep(1)

            # Notificar a propietarios
            from apps.users.models import User

            propietarios = User.objects.filter(role="propietario")

            for propietario in propietarios:
                config_prop, _ = NotificacionConfig.objects.get_or_create(
                    user=propietario, defaults={"notificar_solicitud_turno": True}
                )

                if config_prop.notificar_solicitud_turno:
                    Notificacion.objects.create(
                        usuario=propietario,
                        tipo="solicitud_turno",
                        titulo="Nuevo turno en el sistema",
                        mensaje=f"Se asignó un turno a {instance.empleado.user.get_full_name()} "
                        f"de parte de {instance.cliente.nombre_completo} "
                        f"para {instance.servicio.nombre} (${instance.servicio.precio})",
                        data={
                            "turno_id": instance.id,
                            "empleado": instance.empleado.user.get_full_name(),
                            "cliente": instance.cliente.nombre_completo,
                            "servicio": instance.servicio.nombre,
                            "precio": str(instance.servicio.precio),
                            "fecha_hora": instance.fecha_hora.isoformat(),
                        },
                    )

            # Enviar email a propietarios
            EmailService.enviar_email_nuevo_turno_propietario(instance)

            # Delay para evitar límite de Mailtrap
            import time

            time.sleep(1)

            # Enviar email de confirmación al cliente
            logger.info(
                f"Enviando email de confirmación al cliente {instance.cliente.user.email}"
            )
            resultado_cliente = EmailService.enviar_email_nuevo_turno_cliente(instance)
            logger.info(f"Resultado envío email cliente: {resultado_cliente}")

            logger.info(
                f"Notificaciones y emails enviados para nuevo turno {instance.id}"
            )

        except Exception as e:
            logger.error(f"Error en signal de creación de turno: {str(e)}")


# Variable global para trackear cambios antes de guardar
_turno_anterior = {}


@receiver(pre_save, sender=Turno)
def capturar_estado_anterior(sender, instance, **kwargs):
    """
    Captura el estado anterior del turno antes de guardarlo
    para detectar cambios
    """
    if instance.pk:
        try:
            turno_anterior = Turno.objects.get(pk=instance.pk)
            _turno_anterior[instance.pk] = {
                "estado": turno_anterior.estado,
                "fecha_hora": turno_anterior.fecha_hora,
                "empleado_id": turno_anterior.empleado_id,
                "servicio_id": turno_anterior.servicio_id,
            }
        except Turno.DoesNotExist:
            pass


@receiver(post_save, sender=Turno)
def manejar_modificacion_turno(sender, instance, created, **kwargs):
    """
    Detecta modificaciones en turnos existentes y envía notificaciones
    """
    if not created and instance.pk in _turno_anterior:
        try:
            anterior = _turno_anterior[instance.pk]
            cambios = {}

            # Detectar cambios específicos
            if anterior["estado"] != instance.estado:
                if instance.estado == "cancelado":
                    # Manejar cancelación
                    manejar_cancelacion_turno(instance)

                elif (
                    instance.estado == "completado"
                    and anterior["estado"] != "completado"
                ):
                    # Turno completado - podría enviar notificación de pago pendiente
                    manejar_turno_completado(instance)

                cambios["Estado"] = {
                    "anterior": anterior["estado"],
                    "nuevo": instance.estado,
                }

            if anterior["fecha_hora"] != instance.fecha_hora:
                cambios["Fecha y Hora"] = {
                    "anterior": anterior["fecha_hora"].strftime("%d/%m/%Y %H:%M"),
                    "nuevo": instance.fecha_hora.strftime("%d/%m/%Y %H:%M"),
                }

            if anterior["empleado_id"] != instance.empleado_id:
                try:
                    from apps.empleados.models import Empleado

                    emp_anterior = Empleado.objects.get(pk=anterior["empleado_id"])
                    cambios["Profesional"] = {
                        "anterior": emp_anterior.user.get_full_name(),
                        "nuevo": instance.empleado.user.get_full_name(),
                    }
                except:
                    pass

            if anterior["servicio_id"] != instance.servicio_id:
                try:
                    from apps.servicios.models import Servicio

                    serv_anterior = Servicio.objects.get(pk=anterior["servicio_id"])
                    cambios["Servicio"] = {
                        "anterior": serv_anterior.nombre,
                        "nuevo": instance.servicio.nombre,
                    }
                except:
                    pass

            # Si hay cambios significativos (no solo cancelación), notificar
            if cambios and instance.estado != "cancelado":
                config_profesional, _ = NotificacionConfig.objects.get_or_create(
                    user=instance.empleado.user,
                    defaults={
                        "notificar_modificacion_turno": True,
                        "email_modificacion_turno": True,
                    },
                )

                if config_profesional.notificar_modificacion_turno:
                    Notificacion.objects.create(
                        usuario=instance.empleado.user,
                        tipo="modificacion_turno",
                        titulo="Turno modificado",
                        mensaje=f"Se ha modificado tu turno con {instance.cliente.nombre_completo}",
                        data={
                            "turno_id": instance.id,
                            "cambios": cambios,
                        },
                    )

                # Enviar email solo si está configurado
                if config_profesional.email_modificacion_turno:
                    EmailService.enviar_email_modificacion_turno(instance, cambios)

            # Limpiar del tracking
            del _turno_anterior[instance.pk]

        except Exception as e:
            logger.error(f"Error en signal de modificación de turno: {str(e)}")


def manejar_cancelacion_turno(turno):
    """
    Maneja la lógica cuando un turno es cancelado
    """
    try:
        # Notificar al profesional
        config_profesional, _ = NotificacionConfig.objects.get_or_create(
            user=turno.empleado.user,
            defaults={
                "notificar_cancelacion_turno": True,
                "email_cancelacion_turno": True,
            },
        )

        if config_profesional.notificar_cancelacion_turno:
            Notificacion.objects.create(
                usuario=turno.empleado.user,
                tipo="cancelacion_turno",
                titulo="Turno cancelado",
                mensaje=f"El turno con {turno.cliente.nombre_completo} "
                f'del {turno.fecha_hora.strftime("%d/%m/%Y %H:%M")} ha sido cancelado',
                data={
                    "turno_id": turno.id,
                    "cliente": turno.cliente.nombre_completo,
                    "fecha_hora": turno.fecha_hora.isoformat(),
                },
            )

        # Notificar a propietarios
        from apps.users.models import User

        propietarios = User.objects.filter(role="propietario")

        for propietario in propietarios:
            config_prop, _ = NotificacionConfig.objects.get_or_create(
                user=propietario, defaults={"notificar_cancelacion_turno": True}
            )

            if config_prop.notificar_cancelacion_turno:
                Notificacion.objects.create(
                    usuario=propietario,
                    tipo="cancelacion_turno",
                    titulo="Turno cancelado",
                    mensaje=f"Se canceló el turno de {turno.empleado.user.get_full_name()} "
                    f"con {turno.cliente.nombre_completo}",
                    data={
                        "turno_id": turno.id,
                        "empleado": turno.empleado.user.get_full_name(),
                        "cliente": turno.cliente.nombre_completo,
                    },
                )

        # Enviar email de cancelación solo si está configurado
        if config_profesional.email_cancelacion_turno:
            EmailService.enviar_email_cancelacion_turno(turno, cancelado_por="cliente")

        # Iniciar flujo de reasignación/reacomodamiento automático si aplica
        try:
            if turno.fecha_hora and turno.fecha_hora > timezone.now():
                if turno.servicio and turno.servicio.permite_reacomodamiento:
                    from apps.turnos.tasks import iniciar_reacomodamiento_proceso_2

                    iniciar_reacomodamiento_proceso_2.delay(turno.id)
                else:
                    from apps.turnos.tasks import iniciar_reasignacion_turno

                    iniciar_reasignacion_turno.delay(turno.id)
        except Exception as e:
            logger.error(
                "Error iniciando reasignación/reacomodamiento automático "
                f"para turno {turno.id}: {str(e)}"
            )

        logger.info(f"Notificaciones de cancelación enviadas para turno {turno.id}")

    except Exception as e:
        logger.error(f"Error manejando cancelación de turno: {str(e)}")


def manejar_turno_completado(turno):
    """
    Maneja la lógica cuando un turno es marcado como completado
    Puede enviar recordatorio de pago si aplica
    """
    try:
        # Aquí se podría agregar lógica de pago pendiente
        # Por ahora solo registramos
        logger.info(f"Turno {turno.id} marcado como completado")

        # Si no tiene precio_final asignado, notificar pago pendiente
        if not turno.precio_final:
            config_profesional, _ = NotificacionConfig.objects.get_or_create(
                user=turno.empleado.user, defaults={"notificar_pago_turno": True}
            )

            if config_profesional.notificar_pago_turno:
                Notificacion.objects.create(
                    usuario=turno.empleado.user,
                    tipo="pago_turno",
                    titulo="Pago pendiente",
                    mensaje=f"Recuerda registrar el pago del turno con {turno.cliente.nombre_completo}",
                    data={
                        "turno_id": turno.id,
                        "cliente": turno.cliente.nombre_completo,
                        "monto": str(turno.servicio.precio),
                    },
                )

                # Enviar email de pago pendiente
                EmailService.enviar_email_pago_pendiente_profesional(turno)

    except Exception as e:
        logger.error(f"Error manejando turno completado: {str(e)}")
