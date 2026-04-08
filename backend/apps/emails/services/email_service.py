"""
Servicio para envío de emails con plantillas HTML
Gestiona el envío de notificaciones por email a profesionales y propietarios
"""

from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.utils import timezone
from django.urls import reverse
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


class EmailService:
    """Servicio centralizado para envío de emails"""

    @staticmethod
    def _get_email_destinatario(email_original: str) -> str:
        """
        Retorna el email de destino según el entorno
        En DEBUG, envía a Mailtrap (gimenezivanb@gmail.com)
        En producción, envía al email real
        """
        if settings.DEBUG:
            return "gimenezivanb@gmail.com"
        return email_original

    @staticmethod
    def _get_base_template() -> str:
        """Plantilla base HTML para todos los emails"""
        return """
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>{titulo}</title>
            <style>
                * {{
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }}
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    background-color: #f5f5f5;
                }}
                .container {{
                    max-width: 600px;
                    margin: 20px auto;
                    background-color: #ffffff;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }}
                .header {{
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 30px 20px;
                    text-align: center;
                    color: white;
                }}
                .header h1 {{
                    font-size: 24px;
                    font-weight: 600;
                    margin: 0;
                }}
                .header p {{
                    font-size: 14px;
                    margin-top: 5px;
                    opacity: 0.9;
                }}
                .content {{
                    padding: 30px 20px;
                }}
                .info-box {{
                    background-color: #f8f9fa;
                    border-left: 4px solid #667eea;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 4px;
                }}
                .info-row {{
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid #e9ecef;
                }}
                .info-row:last-child {{
                    border-bottom: none;
                }}
                .info-label {{
                    font-weight: 600;
                    color: #495057;
                }}
                .info-value {{
                    color: #212529;
                }}
                .button {{
                    display: inline-block;
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-decoration: none;
                    border-radius: 6px;
                    font-weight: 600;
                    margin: 20px 0;
                    text-align: center;
                }}
                .button:hover {{
                    opacity: 0.9;
                }}
                .footer {{
                    background-color: #f8f9fa;
                    padding: 20px;
                    text-align: center;
                    font-size: 12px;
                    color: #6c757d;
                }}
                .alert {{
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 6px;
                    font-size: 14px;
                }}
                .alert-warning {{
                    background-color: #fff3cd;
                    border-left: 4px solid #ffc107;
                    color: #856404;
                }}
                .alert-success {{
                    background-color: #d4edda;
                    border-left: 4px solid #28a745;
                    color: #155724;
                }}
                .alert-info {{
                    background-color: #d1ecf1;
                    border-left: 4px solid #17a2b8;
                    color: #0c5460;
                }}
                @media only screen and (max-width: 600px) {{
                    .container {{
                        margin: 0;
                        border-radius: 0;
                    }}
                    .content {{
                        padding: 20px 15px;
                    }}
                    .info-row {{
                        flex-direction: column;
                        gap: 5px;
                    }}
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>{header_titulo}</h1>
                    <p>Beautiful Studio</p>
                </div>
                <div class="content">
                    {contenido}
                </div>
                <div class="footer">
                    <p>&copy; 2025 Beautiful Studio. Todos los derechos reservados.</p>
                    <p>Este es un email automático, por favor no responder.</p>
                </div>
            </div>
        </body>
        </html>
        """

    @staticmethod
    def enviar_email_nuevo_turno_profesional(turno) -> bool:
        """
        Envía email al profesional cuando se le asigna un nuevo turno
        """
        try:
            # Validar que existe el profesional y su email
            if not turno.empleado:
                logger.warning(f"Turno #{turno.id} no tiene empleado asignado")
                return False

            if not turno.empleado.user:
                logger.warning(
                    f"Empleado #{turno.empleado.id} no tiene usuario asociado"
                )
                return False

            if not turno.empleado.user.email:
                logger.warning(
                    f"Usuario {turno.empleado.user.username} no tiene email configurado"
                )
                return False

            logger.info(
                f"Preparando email para profesional: {turno.empleado.user.email}"
            )

            contenido = f"""
                <h2 style="color: #667eea; margin-bottom: 20px;">Tienes un nuevo turno asignado</h2>
                
                <p>Hola <strong>{turno.empleado.user.first_name or turno.empleado.user.username}</strong>,</p>
                <p>Se te ha asignado un nuevo turno. A continuación los detalles:</p>
                
                <div class="info-box">
                    <div class="info-row">
                        <span class="info-label">Cliente:</span>
                        <span class="info-value">{turno.cliente.nombre_completo}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Servicio:</span>
                        <span class="info-value">{turno.servicio.nombre}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Fecha y Hora:</span>
                        <span class="info-value">{turno.fecha_hora.strftime('%d/%m/%Y %H:%M')}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Duración:</span>
                        <span class="info-value">{turno.servicio.duracion_minutos} minutos</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Precio:</span>
                        <span class="info-value">${turno.servicio.precio}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Estado:</span>
                        <span class="info-value">{turno.get_estado_display()}</span>
                    </div>
                </div>
                
                {f'<div class="alert alert-info"><strong>Nota del cliente:</strong> {turno.notas_cliente}</div>' if turno.notas_cliente else ''}
                
                <p>Recuerda revisar tu panel de control para más detalles.</p>
            """

            html_message = EmailService._get_base_template().format(
                titulo="Nuevo Turno Asignado",
                header_titulo="Nuevo Turno",
                contenido=contenido,
            )

            plain_message = strip_tags(html_message)

            email_destino = EmailService._get_email_destinatario(
                turno.empleado.user.email
            )

            send_mail(
                subject=f"Hola {turno.empleado.user.first_name or turno.empleado.user.username}, tienes un nuevo turno",
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email_destino],
                html_message=html_message,
                fail_silently=False,
            )

            logger.info(
                f"Email de nuevo turno enviado a {email_destino} (original: {turno.empleado.user.email})"
            )
            return True

        except Exception as e:
            logger.error(f"Error enviando email de nuevo turno: {str(e)}")
            return False

    @staticmethod
    def enviar_email_nuevo_turno_cliente(turno) -> bool:
        """
        Envía email al cliente cuando reserva un nuevo turno
        """
        try:
            # Validar que existe el cliente y su email
            if not turno.cliente:
                logger.warning(f"Turno #{turno.id} no tiene cliente asignado")
                return False

            if not turno.cliente.user:
                logger.warning(f"Cliente #{turno.cliente.id} no tiene usuario asociado")
                return False

            if not turno.cliente.user.email:
                logger.warning(
                    f"Usuario {turno.cliente.user.username} no tiene email configurado"
                )
                return False

            logger.info(
                f"Preparando email de confirmación para cliente: {turno.cliente.user.email}"
            )

            # Cargar datos fiscales/configuración global para el comprobante
            try:
                from apps.authentication.models import ConfiguracionGlobal

                config_global = ConfiguracionGlobal.get_config()
                nombre_empresa = config_global.nombre_empresa or "Beautiful Studio"
                razon_social = config_global.razon_social or ""
                cuit = config_global.cuit or ""
                fecha_fundacion = config_global.fecha_fundacion
                fecha_fundacion_str = (
                    fecha_fundacion.strftime("%d/%m/%Y") if fecha_fundacion else ""
                )
            except Exception:
                nombre_empresa = "Beautiful Studio"
                razon_social = ""
                cuit = ""
                fecha_fundacion_str = ""

            # Intentar construir la URL de comprobante PDF si existe un pago aprobado
            comprobante_pdf_url = None
            try:
                from apps.mercadopago.models import PagoMercadoPago

                pago_mp = PagoMercadoPago.objects.filter(
                    turno=turno, estado="approved"
                ).first()
                if pago_mp:
                    base_url = (
                        settings.FRONTEND_URL
                        if hasattr(settings, "FRONTEND_URL")
                        else "http://localhost:3000"
                    )
                    path = reverse(
                        "comprobante-pago-pdf", kwargs={"turno_id": turno.id}
                    )
                    comprobante_pdf_url = f"{base_url.rstrip('/')}{path}"
            except Exception as e:
                logger.warning(
                    "No se pudo construir URL de comprobante PDF para turno %s: %s",
                    turno.id,
                    str(e),
                )

            contenido = f"""
                <h2 style="color: #667eea; margin-bottom: 20px;">Tu turno ha sido confirmado</h2>
                
                <p>Hola <strong>{turno.cliente.user.first_name or turno.cliente.user.username}</strong>,</p>
                <p>Tu turno ha sido confirmado exitosamente. A continuación los detalles:</p>
                
                <div class="info-box">
                    <div class="info-row">
                        <span class="info-label">Profesional:</span>
                        <span class="info-value">{turno.empleado.user.get_full_name()}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Servicio:</span>
                        <span class="info-value">{turno.servicio.nombre}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Fecha y Hora:</span>
                        <span class="info-value">{turno.fecha_hora.strftime('%d/%m/%Y %H:%M')}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Duración:</span>
                        <span class="info-value">{turno.servicio.duracion_minutos} minutos</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Precio:</span>
                        <span class="info-value">${turno.servicio.precio}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Estado:</span>
                        <span class="info-value">{turno.get_estado_display()}</span>
                    </div>
                </div>
                <div class="info-box" style="margin-top: 20px;">
                    <div class="info-row">
                        <span class="info-label">Nombre de fantasía:</span>
                        <span class="info-value">{nombre_empresa}</span>
                    </div>
                    {f'<div class="info-row"><span class="info-label">Razón social:</span><span class="info-value">{razon_social}</span></div>' if razon_social else ''}
                    {f'<div class="info-row"><span class="info-label">CUIT:</span><span class="info-value">{cuit}</span></div>' if cuit else ''}
                    {f'<div class="info-row"><span class="info-label">Fecha de inicio:</span><span class="info-value">{fecha_fundacion_str}</span></div>' if fecha_fundacion_str else ''}
                </div>
                {f'<p style="margin-top: 20px; text-align: center;"><a href="{comprobante_pdf_url}" class="button" target="_blank" rel="noopener noreferrer">Descargar comprobante de pago (PDF)</a></p>' if comprobante_pdf_url else ''}

                <p>Te esperamos en {nombre_empresa}. ¡Gracias por elegirnos!</p>
            """

            html_message = EmailService._get_base_template().format(
                titulo="Turno Confirmado",
                header_titulo="Turno Confirmado",
                contenido=contenido,
            )

            plain_message = strip_tags(html_message)

            email_destino = EmailService._get_email_destinatario(
                turno.cliente.user.email
            )

            send_mail(
                subject=f"Hola {turno.cliente.user.first_name or turno.cliente.user.username}, tu turno ha sido confirmado",
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email_destino],
                html_message=html_message,
                fail_silently=False,
            )

            logger.info(
                f"Email de confirmación enviado a {email_destino} (original: {turno.cliente.user.email})"
            )
            return True

        except Exception as e:
            logger.error(f"Error enviando email de confirmación al cliente: {str(e)}")
            return False

    @staticmethod
    def enviar_email_nuevo_turno_propietario(turno) -> bool:
        """
        Envía email al propietario cuando se crea un nuevo turno
        """
        try:
            from apps.users.models import User

            # Obtener propietarios
            propietarios = User.objects.filter(role="propietario")

            if not propietarios.exists():
                logger.warning("No hay propietarios registrados para enviar email")
                return False

            contenido = f"""
                <h2 style="color: #667eea; margin-bottom: 20px;">Se registró un nuevo turno</h2>
                
                <p>Se registró un nuevo turno en Beautiful Studio:</p>
                
                <div class="info-box">
                    <div class="info-row">
                        <span class="info-label">Profesional:</span>
                        <span class="info-value">{turno.empleado.user.get_full_name()}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Cliente:</span>
                        <span class="info-value">{turno.cliente.nombre_completo}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Servicio:</span>
                        <span class="info-value">{turno.servicio.nombre}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Fecha y Hora:</span>
                        <span class="info-value">{turno.fecha_hora.strftime('%d/%m/%Y %H:%M')}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Precio:</span>
                        <span class="info-value">${turno.servicio.precio}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Estado:</span>
                        <span class="info-value">{turno.get_estado_display()}</span>
                    </div>
                </div>
                
                <p style="margin-top: 20px;">Puedes revisar todos los detalles desde tu panel de control.</p>
            """

            html_message = EmailService._get_base_template().format(
                titulo="Nuevo Turno Registrado",
                header_titulo="Nuevo Turno",
                contenido=contenido,
            )

            plain_message = strip_tags(html_message)

            # En DEBUG, enviar a Mailtrap
            if settings.DEBUG:
                emails_propietarios = ["gimenezivanb@gmail.com"]
            else:
                emails_propietarios = [p.email for p in propietarios]

            send_mail(
                subject="Se registró un nuevo turno",
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=emails_propietarios,
                html_message=html_message,
                fail_silently=False,
            )

            logger.info(
                f"Email de nuevo turno enviado a propietarios: {emails_propietarios}"
            )
            return True

        except Exception as e:
            logger.error(f"Error enviando email a propietarios: {str(e)}")
            return False

    # ------------------------------------------------------------------
    # Emails de fidelización de clientes
    # ------------------------------------------------------------------

    @staticmethod
    def enviar_email_fidelizacion_con_saldo(
        *,
        cliente,
        servicio,
        empleado,
        fecha_sugerida,
        saldo_disponible,
        url_reserva: str,
    ) -> bool:
        """Email de fidelización para clientes con crédito en billetera.

        Este email le recuerda al cliente que tiene saldo a favor y le
        propone volver con su servicio habitual, usando el link de
        fidelización (flujo con saldo).
        """

        try:
            if not getattr(cliente, "user", None) or not cliente.user.email:
                logger.warning("Cliente sin usuario o sin email para fidelización")
                return False

            nombre_cliente = cliente.user.first_name or getattr(
                cliente, "nombre_completo", "Cliente"
            )
            nombre_profesional = empleado.user.get_full_name()

            contenido = f"""
                <h2 style="color: #667eea; margin-bottom: 20px;">Te extrañamos en Beautiful Studio</h2>

                <p>Hola <strong>{nombre_cliente}</strong>,</p>
                <p>
                    Vimos que hace un tiempo que no nos visitás y aún tenés
                    <strong>${float(saldo_disponible):.2f}</strong> de crédito en tu billetera
                    para usar en tu próximo servicio.
                </p>

                <div class="info-box">
                    <div class="info-row">
                        <span class="info-label">Servicio sugerido:</span>
                        <span class="info-value">{servicio.nombre}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Profesional:</span>
                        <span class="info-value">{nombre_profesional}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Próximo horario sugerido:</span>
                        <span class="info-value">{fecha_sugerida.strftime('%d/%m/%Y %H:%M')}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Crédito disponible:</span>
                        <span class="info-value">${float(saldo_disponible):.2f}</span>
                    </div>
                </div>

                <p style="margin-top: 16px;">Puedes usar ese crédito para reservar tu próximo turno ahora mismo:</p>

                <div style="text-align: center;">
                    <a href="{url_reserva}" class="button">Reservar mi turno</a>
                </div>

                <p style="margin-top: 12px; font-size: 13px; color: #6c757d;">
                    Si ya utilizaste tu crédito recientemente, puedes ignorar este mensaje.
                </p>
            """

            html_message = EmailService._get_base_template().format(
                titulo="Te extrañamos en Beautiful Studio",
                header_titulo="Tienes crédito disponible",
                contenido=contenido,
            )

            plain_message = strip_tags(html_message)

            email_destino = EmailService._get_email_destinatario(cliente.user.email)

            send_mail(
                subject="Tienes crédito disponible para tu próximo turno",
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email_destino],
                html_message=html_message,
                fail_silently=False,
            )

            logger.info(
                "Email de fidelización (con saldo) enviado a %s (original: %s)",
                email_destino,
                cliente.user.email,
            )
            return True

        except Exception as e:
            logger.error(
                "Error enviando email de fidelización con saldo a %s: %s",
                getattr(cliente.user, "email", "<sin email>"),
                str(e),
            )
            return False

    @staticmethod
    def enviar_email_fidelizacion_sin_saldo(
        *,
        cliente,
        servicio,
        empleado,
        fecha_sugerida,
        url_reserva: str,
    ) -> bool:
        """Email de fidelización para clientes sin saldo (descuento).

        Ofrece un beneficio especial por fidelización (descuento) y
        redirige al nuevo flujo de pago con descuento.
        """

        try:
            if not getattr(cliente, "user", None) or not cliente.user.email:
                logger.warning("Cliente sin usuario o sin email para fidelización")
                return False

            # Determinar porcentaje de descuento de fidelización
            try:
                from apps.authentication.models import ConfiguracionGlobal
                from decimal import Decimal

                config_global = ConfiguracionGlobal.get_config()
                descuento_pct = (
                    servicio.descuento_fidelizacion_pct
                    or config_global.descuento_fidelizacion_pct
                    or 0
                )
                precio_original = Decimal(servicio.precio)
                precio_con_descuento = precio_original * (
                    Decimal("1.0") - Decimal(descuento_pct) / Decimal("100")
                )
            except Exception:
                descuento_pct = 0
                precio_original = servicio.precio
                precio_con_descuento = precio_original

            nombre_cliente = cliente.user.first_name or getattr(
                cliente, "nombre_completo", "Cliente"
            )
            nombre_profesional = empleado.user.get_full_name()

            contenido = f"""
                <h2 style="color: #667eea; margin-bottom: 20px;">Tenemos un beneficio especial para vos</h2>

                <p>Hola <strong>{nombre_cliente}</strong>,</p>
                <p>
                    Hace un tiempo que no nos visitás. Para agradecerte por haber
                    confiado en nosotros, queremos ofrecerte un
                    <strong>{descuento_pct:.0f}% de descuento</strong> en tu próximo
                    servicio habitual.
                </p>

                <div class="info-box">
                    <div class="info-row">
                        <span class="info-label">Servicio sugerido:</span>
                        <span class="info-value">{servicio.nombre}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Profesional:</span>
                        <span class="info-value">{nombre_profesional}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Horario sugerido:</span>
                        <span class="info-value">{fecha_sugerida.strftime('%d/%m/%Y %H:%M')}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Precio habitual:</span>
                        <span class="info-value">${float(precio_original):.2f}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Precio con beneficio:</span>
                        <span class="info-value">${float(precio_con_descuento):.2f}</span>
                    </div>
                </div>

                <p style="margin-top: 16px;">
                    Podés aprovechar este beneficio reservando desde el siguiente enlace:
                </p>

                <div style="text-align: center;">
                    <a href="{url_reserva}" class="button">Aprovechar mi beneficio</a>
                </div>

                <p style="margin-top: 12px; font-size: 13px; color: #6c757d;">
                    Este beneficio es personal y por tiempo limitado.
                </p>
            """

            html_message = EmailService._get_base_template().format(
                titulo="Beneficio de fidelización",
                header_titulo="Beneficio especial",
                contenido=contenido,
            )

            plain_message = strip_tags(html_message)

            email_destino = EmailService._get_email_destinatario(cliente.user.email)

            send_mail(
                subject="Tenés un beneficio especial en tu próximo turno",
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email_destino],
                html_message=html_message,
                fail_silently=False,
            )

            logger.info(
                "Email de fidelización (sin saldo) enviado a %s (original: %s)",
                email_destino,
                cliente.user.email,
            )
            return True

        except Exception as e:
            logger.error(
                "Error enviando email de fidelización sin saldo a %s: %s",
                getattr(cliente.user, "email", "<sin email>"),
                str(e),
            )
            return False

    @staticmethod
    def enviar_email_pago_pendiente_profesional(turno) -> bool:
        """
        Envía email al profesional notificando pago pendiente de un turno
        """
        try:
            contenido = f"""
                <h2 style="color: #667eea; margin-bottom: 20px;">Turno pendiente de pago</h2>
                
                <p>Hola <strong>{turno.empleado.user.get_full_name()}</strong>,</p>
                
                <div class="alert alert-warning">
                    <strong>¡Atención!</strong> Tienes un turno completado pendiente de pago.
                </div>
                
                <div class="info-box">
                    <div class="info-row">
                        <span class="info-label">Cliente:</span>
                        <span class="info-value">{turno.cliente.nombre_completo}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Servicio:</span>
                        <span class="info-value">{turno.servicio.nombre}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Fecha realizado:</span>
                        <span class="info-value">{turno.fecha_hora.strftime('%d/%m/%Y %H:%M')}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Monto:</span>
                        <span class="info-value">${turno.precio_final or turno.servicio.precio}</span>
                    </div>
                </div>
                
                <p>Por favor, gestiona el cobro con el cliente o notifica al propietario.</p>
            """

            html_message = EmailService._get_base_template().format(
                titulo="Pago Pendiente",
                header_titulo="Pago Pendiente",
                contenido=contenido,
            )

            plain_message = strip_tags(html_message)

            email_destino = EmailService._get_email_destinatario(
                turno.empleado.user.email
            )

            send_mail(
                subject=f"Pago pendiente - {turno.cliente.nombre_completo}",
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email_destino],
                html_message=html_message,
                fail_silently=False,
            )

            logger.info(
                f"Email de pago pendiente enviado a {email_destino} (original: {turno.empleado.user.email})"
            )
            return True

        except Exception as e:
            logger.error(f"Error enviando email de pago pendiente: {str(e)}")
            return False

    @staticmethod
    def enviar_email_cancelacion_turno(turno, cancelado_por: str = "cliente") -> bool:
        """
        Envía email notificando la cancelación de un turno

        Args:
            turno: Instancia del turno cancelado
            cancelado_por: Quien canceló el turno ('cliente', 'profesional', 'sistema')
        """
        try:
            # Email al profesional
            contenido_profesional = f"""
                <h2 style="color: #dc3545; margin-bottom: 20px;">Turno cancelado</h2>
                
                <p>Hola <strong>{turno.empleado.user.get_full_name()}</strong>,</p>
                
                <div class="alert alert-warning">
                    <strong>Turno cancelado</strong> {'por el cliente' if cancelado_por == 'cliente' else 'por el sistema'}.
                </div>
                
                <div class="info-box">
                    <div class="info-row">
                        <span class="info-label">Cliente:</span>
                        <span class="info-value">{turno.cliente.nombre_completo}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Servicio:</span>
                        <span class="info-value">{turno.servicio.nombre}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Fecha y Hora:</span>
                        <span class="info-value">{turno.fecha_hora.strftime('%d/%m/%Y %H:%M')}</span>
                    </div>
                </div>
                
                <p>Este horario ahora está disponible para nuevos turnos.</p>
            """

            html_message = EmailService._get_base_template().format(
                titulo="Turno Cancelado",
                header_titulo="Turno Cancelado",
                contenido=contenido_profesional,
            )

            email_destino = EmailService._get_email_destinatario(
                turno.empleado.user.email
            )

            send_mail(
                subject=f'Turno cancelado - {turno.fecha_hora.strftime("%d/%m/%Y %H:%M")}',
                message=strip_tags(html_message),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email_destino],
                html_message=html_message,
                fail_silently=False,
            )

            # Email al propietario
            from apps.users.models import User

            propietarios = User.objects.filter(role="propietario")

            if propietarios.exists():
                contenido_propietario = f"""
                    <h2 style="color: #dc3545; margin-bottom: 20px;">Turno cancelado</h2>
                    
                    <p>Se ha cancelado un turno en Beautiful Studio:</p>
                    
                    <div class="info-box">
                        <div class="info-row">
                            <span class="info-label">Profesional:</span>
                            <span class="info-value">{turno.empleado.user.get_full_name()}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Cliente:</span>
                            <span class="info-value">{turno.cliente.nombre_completo}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Servicio:</span>
                            <span class="info-value">{turno.servicio.nombre}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Fecha y Hora:</span>
                            <span class="info-value">{turno.fecha_hora.strftime('%d/%m/%Y %H:%M')}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Cancelado por:</span>
                            <span class="info-value">{cancelado_por.capitalize()}</span>
                        </div>
                    </div>
                """

                html_message_prop = EmailService._get_base_template().format(
                    titulo="Turno Cancelado",
                    header_titulo="Turno Cancelado",
                    contenido=contenido_propietario,
                )

                # En DEBUG, enviar a Mailtrap
                if settings.DEBUG:
                    emails_dest = ["gimenezivanb@gmail.com"]
                else:
                    emails_dest = [p.email for p in propietarios]

                send_mail(
                    subject=f"Turno cancelado - {turno.empleado.user.get_full_name()}",
                    message=strip_tags(html_message_prop),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=emails_dest,
                    html_message=html_message_prop,
                    fail_silently=False,
                )

            logger.info(f"Emails de cancelación enviados para turno {turno.id}")
            return True

        except Exception as e:
            logger.error(f"Error enviando email de cancelación: {str(e)}")
            return False

    @staticmethod
    def enviar_email_modificacion_turno(turno, cambios: Dict) -> bool:
        """
        Envía email notificando la modificación de un turno

        Args:
            turno: Instancia del turno modificado
            cambios: Diccionario con los cambios realizados
        """
        try:
            cambios_html = ""
            for campo, valores in cambios.items():
                cambios_html += f"""
                    <div class="info-row">
                        <span class="info-label">{campo}:</span>
                        <span class="info-value">{valores['anterior']} → {valores['nuevo']}</span>
                    </div>
                """

            contenido = f"""
                <h2 style="color: #667eea; margin-bottom: 20px;">Turno modificado</h2>
                
                <p>Hola <strong>{turno.empleado.user.get_full_name()}</strong>,</p>
                
                <div class="alert alert-info">
                    Se ha modificado un turno asignado a ti.
                </div>
                
                <h3 style="margin-top: 20px;">Cambios realizados:</h3>
                <div class="info-box">
                    {cambios_html}
                </div>
                
                <h3 style="margin-top: 20px;">Información del turno:</h3>
                <div class="info-box">
                    <div class="info-row">
                        <span class="info-label">Cliente:</span>
                        <span class="info-value">{turno.cliente.nombre_completo}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Servicio:</span>
                        <span class="info-value">{turno.servicio.nombre}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Fecha y Hora:</span>
                        <span class="info-value">{turno.fecha_hora.strftime('%d/%m/%Y %H:%M')}</span>
                    </div>
                </div>
            """

            html_message = EmailService._get_base_template().format(
                titulo="Turno Modificado",
                header_titulo="Turno Modificado",
                contenido=contenido,
            )

            plain_message = strip_tags(html_message)

            email_destino = EmailService._get_email_destinatario(
                turno.empleado.user.email
            )

            send_mail(
                subject=f'Turno modificado - {turno.fecha_hora.strftime("%d/%m/%Y %H:%M")}',
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email_destino],
                html_message=html_message,
                fail_silently=False,
            )

            logger.info(
                f"Email de modificación enviado a {email_destino} (original: {turno.empleado.user.email})"
            )
            return True

        except Exception as e:
            logger.error(f"Error enviando email de modificación: {str(e)}")
            return False

    @staticmethod
    def enviar_email_recordatorio_turno(turno) -> bool:
        """
        Envía email recordatorio al profesional sobre un turno próximo
        """
        try:
            contenido = f"""
                <h2 style="color: #667eea; margin-bottom: 20px;">Recordatorio de turno</h2>
                
                <p>Hola <strong>{turno.empleado.user.get_full_name()}</strong>,</p>
                
                <div class="alert alert-info">
                    <strong>Recordatorio:</strong> Tienes un turno programado próximamente.
                </div>
                
                <div class="info-box">
                    <div class="info-row">
                        <span class="info-label">Cliente:</span>
                        <span class="info-value">{turno.cliente.nombre_completo}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Servicio:</span>
                        <span class="info-value">{turno.servicio.nombre}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Fecha y Hora:</span>
                        <span class="info-value">{turno.fecha_hora.strftime('%d/%m/%Y %H:%M')}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Duración:</span>
                        <span class="info-value">{turno.servicio.duracion_minutos} minutos</span>
                    </div>
                </div>
                
                {f'<div class="alert alert-info"><strong>Nota del cliente:</strong> {turno.notas_cliente}</div>' if turno.notas_cliente else ''}
                
                <p>¡Prepárate para ofrecer el mejor servicio!</p>
            """

            html_message = EmailService._get_base_template().format(
                titulo="Recordatorio de Turno",
                header_titulo="Recordatorio",
                contenido=contenido,
            )

            plain_message = strip_tags(html_message)

            email_destino = EmailService._get_email_destinatario(
                turno.empleado.user.email
            )

            send_mail(
                subject=f'Recordatorio: Turno {turno.fecha_hora.strftime("%d/%m/%Y %H:%M")}',
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email_destino],
                html_message=html_message,
                fail_silently=False,
            )

            logger.info(
                f"Email recordatorio enviado a {email_destino} (original: {turno.empleado.user.email})"
            )
            return True

        except Exception as e:
            logger.error(f"Error enviando email recordatorio: {str(e)}")
            return False

    @staticmethod
    def enviar_email_reporte_diario_propietario(datos_reporte: Dict) -> bool:
        """
        Envía email con reporte diario de actividad al propietario

        Args:
            datos_reporte: Diccionario con estadísticas del día
        """
        try:
            from apps.users.models import User

            propietarios = User.objects.filter(role="propietario")

            if not propietarios.exists():
                logger.warning("No hay propietarios registrados para enviar reporte")
                return False

            contenido = f"""
                <h2 style="color: #667eea; margin-bottom: 20px;">Resumen diario de actividad</h2>
                
                <p>Aquí está el resumen de la actividad de hoy en Beautiful Studio:</p>
                
                <div class="info-box">
                    <div class="info-row">
                        <span class="info-label">Turnos completados:</span>
                        <span class="info-value">{datos_reporte.get('turnos_completados', 0)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Turnos cancelados:</span>
                        <span class="info-value">{datos_reporte.get('turnos_cancelados', 0)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Turnos pendientes:</span>
                        <span class="info-value">{datos_reporte.get('turnos_pendientes', 0)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Ingresos del día:</span>
                        <span class="info-value">${datos_reporte.get('ingresos_totales', 0)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Nuevos clientes:</span>
                        <span class="info-value">{datos_reporte.get('nuevos_clientes', 0)}</span>
                    </div>
                </div>
                
                <div class="alert alert-success" style="margin-top: 20px;">
                    <strong>¡Excelente trabajo!</strong> Revisa tu panel de control para más detalles.
                </div>
            """

            html_message = EmailService._get_base_template().format(
                titulo="Reporte Diario",
                header_titulo="Reporte Diario",
                contenido=contenido,
            )

            plain_message = strip_tags(html_message)

            # En DEBUG, enviar a Mailtrap
            if settings.DEBUG:
                emails_dest = ["gimenezivanb@gmail.com"]
            else:
                emails_dest = [p.email for p in propietarios]

            send_mail(
                subject=f"Reporte diario - Beautiful Studio",
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=emails_dest,
                html_message=html_message,
                fail_silently=False,
            )

            logger.info(f"Email de reporte diario enviado a: {emails_dest}")
            return True

        except Exception as e:
            logger.error(f"Error enviando reporte diario: {str(e)}")
            return False

    @staticmethod
    def enviar_email_oferta_reasignacion(
        turno_cancelado,
        turno_ofrecido,
        log_reasignacion,
        monto_final,
        monto_descuento,
        senia_pagada,
    ) -> bool:
        """
        Envía email al cliente con una oferta de adelanto de turno
        """
        try:
            if not turno_ofrecido.cliente or not turno_ofrecido.cliente.user:
                logger.warning("Cliente sin usuario asociado para oferta")
                return False

            if not turno_ofrecido.cliente.user.email:
                logger.warning("Cliente sin email configurado para oferta")
                return False

            base_url = (
                settings.FRONTEND_URL
                if hasattr(settings, "FRONTEND_URL")
                else "http://localhost:3000"
            )

            # Link a la página de confirmación del frontend
            confirmar_url = (
                f"{base_url}/reacomodamiento/confirmar?token={log_reasignacion.token}"
            )

            # Fechas en zona horaria local para evitar desfases de GMT
            turno_actual_dt = timezone.localtime(turno_ofrecido.fecha_hora)
            nuevo_turno_dt = timezone.localtime(turno_cancelado.fecha_hora)
            expiracion_dt = timezone.localtime(log_reasignacion.expires_at)

            tipo_pago_cliente = (
                log_reasignacion.tipo_pago_cliente_ofertado
                or turno_ofrecido.resolver_tipo_pago()
            )
            cliente_pago_completo = tipo_pago_cliente == "PAGO_COMPLETO"

            if cliente_pago_completo:
                titulo_email = "Reacomodo de turno disponible"
                header_titulo = "Reacomodo de turno"
                contenido = f"""
                    <h2 style="color: #667eea; margin-bottom: 20px;">¡Se liberó un turno antes de tu fecha!</h2>

                    <p>Hola <strong>{turno_ofrecido.cliente.user.first_name or turno_ofrecido.cliente.user.username}</strong>,</p>
                    <p>Se liberó un turno para el mismo servicio y podemos reacomodarte a una fecha más cercana.</p>
                    <p><strong>Como ya abonaste el 100% del servicio, este reacomodo no incluye descuento promocional adicional.</strong></p>

                    <div class="info-box">
                        <div class="info-row">
                            <span class="info-label">Tu turno actual:</span>
                            <span class="info-value">{turno_actual_dt.strftime('%d/%m/%Y %H:%M')}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Nuevo turno disponible:</span>
                            <span class="info-value"><strong>{nuevo_turno_dt.strftime('%d/%m/%Y %H:%M')}</strong></span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Servicio:</span>
                            <span class="info-value">{turno_cancelado.servicio.nombre}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Profesional:</span>
                            <span class="info-value">{turno_cancelado.empleado.user.get_full_name()}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Precio total:</span>
                            <span class="info-value">${turno_cancelado.servicio.precio}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Pago ya acreditado (servicio completo):</span>
                            <span class="info-value">-${senia_pagada}</span>
                        </div>
                        <div class="info-row" style="border-top: 2px solid #667eea; padding-top: 10px; margin-top: 10px;">
                            <span class="info-label"><strong>Monto final a pagar:</strong></span>
                            <span class="info-value" style="font-size: 1.2em; color: #667eea;"><strong>${monto_final}</strong></span>
                        </div>
                    </div>

                    <div class="alert alert-warning">
                        <strong>⏰ Importante:</strong> Esta propuesta expira el {expiracion_dt.strftime('%d/%m/%Y %H:%M')}.
                    </div>

                    <p style="text-align: center; margin: 30px 0;">
                        <a href="{confirmar_url}" class="button" style="font-size: 1.1em; padding: 15px 40px;">Ver detalles y confirmar reacomodo</a>
                    </p>

                    <p style="color: #718096; font-size: 0.9em; text-align: center;">
                        Si no deseas adelantar tu turno, simplemente ignora este email.<br>
                        Tu turno original se mantendrá sin cambios.
                    </p>
                """
            else:
                titulo_email = "Tenemos un turno antes para ti"
                header_titulo = "Oferta de turno"
                contenido = f"""
                    <h2 style="color: #667eea; margin-bottom: 20px;">¡Se liberó un turno antes de tu fecha!</h2>

                    <p>Hola <strong>{turno_ofrecido.cliente.user.first_name or turno_ofrecido.cliente.user.username}</strong>,</p>
                    <p>Se liberó un turno para el mismo servicio y podemos adelantarte con un descuento especial.</p>

                    <div class="info-box">
                        <div class="info-row">
                            <span class="info-label">Tu turno actual:</span>
                            <span class="info-value">{turno_actual_dt.strftime('%d/%m/%Y %H:%M')}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Nuevo turno disponible:</span>
                            <span class="info-value"><strong>{nuevo_turno_dt.strftime('%d/%m/%Y %H:%M')}</strong></span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Servicio:</span>
                            <span class="info-value">{turno_cancelado.servicio.nombre}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Profesional:</span>
                            <span class="info-value">{turno_cancelado.empleado.user.get_full_name()}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Precio total:</span>
                            <span class="info-value">${turno_cancelado.servicio.precio}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Descuento especial:</span>
                            <span class="info-value" style="color: #48bb78;">-${monto_descuento}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Seña acreditada:</span>
                            <span class="info-value">-${senia_pagada}</span>
                        </div>
                        <div class="info-row" style="border-top: 2px solid #667eea; padding-top: 10px; margin-top: 10px;">
                            <span class="info-label"><strong>Monto final a pagar:</strong></span>
                            <span class="info-value" style="font-size: 1.2em; color: #667eea;"><strong>${monto_final}</strong></span>
                        </div>
                    </div>

                    <div class="alert alert-warning">
                        <strong>⏰ Importante:</strong> Esta oferta expira el {expiracion_dt.strftime('%d/%m/%Y %H:%M')}.
                    </div>

                    <p style="text-align: center; margin: 30px 0;">
                        <a href="{confirmar_url}" class="button" style="font-size: 1.1em; padding: 15px 40px;">Ver detalles y confirmar</a>
                    </p>

                    <p style="color: #718096; font-size: 0.9em; text-align: center;">
                        Si no deseas adelantar tu turno, simplemente ignora este email.<br>
                        Tu turno original se mantendrá sin cambios.
                    </p>
                """

            html_message = EmailService._get_base_template().format(
                titulo=titulo_email,
                header_titulo=header_titulo,
                contenido=contenido,
            )

            plain_message = strip_tags(html_message)
            email_destino = EmailService._get_email_destinatario(
                turno_ofrecido.cliente.user.email
            )

            send_mail(
                subject=titulo_email,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email_destino],
                html_message=html_message,
                fail_silently=False,
            )

            logger.info(f"Email de oferta de reasignación enviado a {email_destino}")
            return True

        except Exception as e:
            logger.error(f"Error enviando email de oferta de reasignación: {str(e)}")
            return False

    @staticmethod
    def enviar_email_recuperacion_password(
        email: str, token: str, usuario_nombre: str = ""
    ) -> bool:
        """
        Envía un email con el enlace para recuperar la contraseña

        Args:
            email: Email del usuario
            token: Token de recuperación
            usuario_nombre: Nombre del usuario (opcional)

        Returns:
            bool: True si el email se envió correctamente
        """
        try:
            # URL del frontend para resetear contraseña
            frontend_url = (
                settings.FRONTEND_URL
                if hasattr(settings, "FRONTEND_URL")
                else "http://localhost:3000"
            )
            reset_url = f"{frontend_url}/reset-password?token={token}"

            # Crear HTML del email
            html_message = f"""
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Recuperar Contraseña</title>
                <style>
                    * {{
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }}
                    body {{
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        background-color: #f5f5f5;
                    }}
                    .container {{
                        max-width: 600px;
                        margin: 20px auto;
                        background-color: #ffffff;
                        border-radius: 12px;
                        overflow: hidden;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    }}
                    .header {{
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        padding: 30px 20px;
                        text-align: center;
                        color: white;
                    }}
                    .header h1 {{
                        font-size: 24px;
                        font-weight: 600;
                        margin: 0;
                    }}
                    .content {{
                        padding: 30px 20px;
                    }}
                    .button {{
                        display: inline-block;
                        padding: 14px 28px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white !important;
                        text-decoration: none;
                        border-radius: 8px;
                        font-weight: 600;
                        text-align: center;
                        margin: 20px 0;
                    }}
                    .warning-box {{
                        background-color: #fff3cd;
                        border-left: 4px solid #ffc107;
                        padding: 15px;
                        margin: 20px 0;
                        border-radius: 4px;
                        color: #856404;
                    }}
                    .footer {{
                        background-color: #f8f9fa;
                        padding: 20px;
                        text-align: center;
                        font-size: 12px;
                        color: #6c757d;
                        border-top: 1px solid #e9ecef;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔑 Recuperar Contraseña</h1>
                    </div>
                    
                    <div class="content">
                        <p>Hola{' ' + usuario_nombre if usuario_nombre else ''},</p>
                        <p style="margin-top: 15px;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>Beautiful Studio</strong>.</p>
                        
                        <p style="margin-top: 15px;">Haz clic en el siguiente botón para crear una nueva contraseña:</p>
                        
                        <div style="text-align: center;">
                            <a href="{reset_url}" class="button">Restablecer Contraseña</a>
                        </div>
                        
                        <div class="warning-box">
                            <strong>⚠️ Importante:</strong>
                            <ul style="margin-top: 10px; padding-left: 20px;">
                                <li>Este enlace es válido por <strong>1 hora</strong></li>
                                <li>Solo puede ser utilizado una vez</li>
                                <li>Si no solicitaste este cambio, ignora este email</li>
                            </ul>
                        </div>
                        
                        <p style="margin-top: 20px; font-size: 14px; color: #6c757d;">
                            Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                            <a href="{reset_url}" style="color: #667eea; word-break: break-all;">{reset_url}</a>
                        </p>
                    </div>
                    
                    <div class="footer">
                        <p><strong>Beautiful Studio</strong></p>
                        <p>Sistema de Gestión de Turnos</p>
                        <p style="margin-top: 10px;">Este es un email automático, por favor no responder.</p>
                    </div>
                </div>
            </body>
            </html>
            """

            plain_message = strip_tags(html_message)

            # En DEBUG, enviar a Mailtrap
            email_dest = (
                EmailService._get_email_destinatario(email) if settings.DEBUG else email
            )

            send_mail(
                subject="Recuperar Contraseña - Beautiful Studio",
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email_dest],
                html_message=html_message,
                fail_silently=False,
            )

            logger.info(f"Email de recuperación de contraseña enviado a: {email_dest}")
            return True

        except Exception as e:
            logger.error(f"Error enviando email de recuperación: {str(e)}")
            return False
