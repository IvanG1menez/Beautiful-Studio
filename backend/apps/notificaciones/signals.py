from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.turnos.models import Turno
from apps.users.models import User
from .models import Notificacion, NotificacionConfig


def crear_notificacion(usuario, tipo, titulo, mensaje, data=None):
    """
    Función helper para crear una notificación si el usuario tiene habilitada ese tipo
    """
    # Obtener o crear configuración del usuario
    config, _ = NotificacionConfig.objects.get_or_create(user=usuario)
    
    # Mapeo de tipos a configuraciones
    tipo_a_config = {
        'solicitud_turno': config.notificar_solicitud_turno,
        'pago_turno': config.notificar_pago_turno,
        'cancelacion_turno': config.notificar_cancelacion_turno,
        'modificacion_turno': config.notificar_modificacion_turno,
        'nuevo_empleado': config.notificar_nuevo_empleado,
        'nuevo_cliente': config.notificar_nuevo_cliente,
        'reporte_diario': config.notificar_reporte_diario,
    }
    
    # Verificar si el usuario quiere recibir este tipo de notificación
    if tipo in tipo_a_config and tipo_a_config[tipo]:
        Notificacion.objects.create(
            usuario=usuario,
            tipo=tipo,
            titulo=titulo,
            mensaje=mensaje,
            data=data or {}
        )


@receiver(post_save, sender=Turno)
def notificar_turno_creado(sender, instance, created, **kwargs):
    """
    Signal que se dispara cuando se crea un nuevo turno
    Notifica al profesional sobre la solicitud
    """
    if created:
        # Notificar al profesional
        if instance.empleado and instance.empleado.user:
            cliente_nombre = f"{instance.cliente.user.first_name} {instance.cliente.user.last_name}" if instance.cliente and instance.cliente.user else "Cliente"
            
            # Formatear fecha y hora desde fecha_hora
            fecha_formateada = instance.fecha_hora.strftime("%d/%m/%Y")
            hora_formateada = instance.fecha_hora.strftime("%H:%M")
            
            crear_notificacion(
                usuario=instance.empleado.user,
                tipo='solicitud_turno',
                titulo='Nueva solicitud de turno',
                mensaje=f'{cliente_nombre} ha solicitado un turno para {instance.servicio.nombre} el {fecha_formateada} a las {hora_formateada}',
                data={
                    'turno_id': instance.id,
                    'cliente_id': instance.cliente.id if instance.cliente else None,
                    'servicio_id': instance.servicio.id,
                    'fecha_hora': instance.fecha_hora.isoformat(),
                }
            )
        
        # Notificar a propietarios sobre nuevo turno
        propietarios = User.objects.filter(role='propietario')
        for propietario in propietarios:
            crear_notificacion(
                usuario=propietario,
                tipo='solicitud_turno',
                titulo='Nuevo turno en el sistema',
                mensaje=f'Se ha creado un nuevo turno para {instance.servicio.nombre} el {instance.fecha_hora.strftime("%d/%m/%Y")}',
                data={
                    'turno_id': instance.id,
                    'empleado_id': instance.empleado.id if instance.empleado else None,
                    'servicio_id': instance.servicio.id,
                }
            )


@receiver(post_save, sender=Turno)
def notificar_pago_turno(sender, instance, created, update_fields, **kwargs):
    """
    Signal que se dispara cuando se actualiza el estado de pago de un turno
    """
    if not created and update_fields and 'pagado' in update_fields:
        if instance.pagado:
            # Notificar al profesional sobre el pago
            if instance.empleado and instance.empleado.user:
                cliente_nombre = f"{instance.cliente.user.first_name} {instance.cliente.user.last_name}" if instance.cliente and instance.cliente.user else "Cliente"
                
                fecha_formateada = instance.fecha_hora.strftime("%d/%m/%Y")
                hora_formateada = instance.fecha_hora.strftime("%H:%M")
                
                crear_notificacion(
                    usuario=instance.empleado.user,
                    tipo='pago_turno',
                    titulo='Turno pagado',
                    mensaje=f'{cliente_nombre} ha pagado el turno del {fecha_formateada} a las {hora_formateada}',
                    data={
                        'turno_id': instance.id,
                        'monto': str(instance.servicio.precio),
                    }
                )


@receiver(post_save, sender=Turno)
def notificar_cancelacion_turno(sender, instance, created, update_fields, **kwargs):
    """
    Signal que se dispara cuando se cancela un turno
    """
    if not created and update_fields and 'estado' in update_fields:
        if instance.estado == 'cancelado':
            # Notificar al profesional sobre la cancelación
            if instance.empleado and instance.empleado.user:
                cliente_nombre = f"{instance.cliente.user.first_name} {instance.cliente.user.last_name}" if instance.cliente and instance.cliente.user else "Cliente"
                
                fecha_formateada = instance.fecha_hora.strftime("%d/%m/%Y")
                hora_formateada = instance.fecha_hora.strftime("%H:%M")
                
                crear_notificacion(
                    usuario=instance.empleado.user,
                    tipo='cancelacion_turno',
                    titulo='Turno cancelado',
                    mensaje=f'{cliente_nombre} ha cancelado el turno del {fecha_formateada} a las {hora_formateada}',
                    data={
                        'turno_id': instance.id,
                        'fecha_hora': instance.fecha_hora.isoformat(),
                    }
                )


@receiver(post_save, sender=User)
def notificar_nuevo_usuario(sender, instance, created, **kwargs):
    """
    Signal que se dispara cuando se crea un nuevo usuario
    Notifica a propietarios sobre nuevos empleados o clientes
    """
    if created and instance.role in ['profesional', 'cliente']:
        propietarios = User.objects.filter(role='propietario')
        
        tipo_notif = 'nuevo_empleado' if instance.role == 'profesional' else 'nuevo_cliente'
        tipo_texto = 'profesional' if instance.role == 'profesional' else 'cliente'
        
        for propietario in propietarios:
            crear_notificacion(
                usuario=propietario,
                tipo=tipo_notif,
                titulo=f'Nuevo {tipo_texto} registrado',
                mensaje=f'{instance.first_name} {instance.last_name} ({instance.email}) se ha registrado como {tipo_texto}',
                data={
                    'user_id': instance.id,
                    'email': instance.email,
                    'role': instance.role,
                }
            )
