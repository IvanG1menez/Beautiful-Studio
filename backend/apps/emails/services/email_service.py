"""
Servicio para envío de emails con plantillas HTML
Gestiona el envío de notificaciones por email a profesionales y propietarios
"""

from django.core.mail import send_mail
from django.conf import settings
from django.utils.html import strip_tags
from django.utils import timezone
from django.urls import reverse
from typing import Dict
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
        template = """
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
                    color: #27212e;
                    background-color: #f6f0f7;
                    -webkit-font-smoothing: antialiased;
                }}
                .wrapper {{
                    width: 100%;
                    padding: 28px 12px;
                    background: radial-gradient(circle at top left, #f4d9ea 0, #f6f0f7 34%, #f7f2ec 100%);
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #ffffff;
                    border-radius: 22px;
                    overflow: hidden;
                    border: 1px solid #eaddea;
                    box-shadow: 0 18px 45px rgba(69, 43, 78, 0.14);
                }}
                .header {{
                    background: linear-gradient(135deg, #3b213f 0%, #6f3f78 52%, #b86a91 100%);
                    padding: 34px 32px 30px;
                    color: #ffffff;
                }}
                .header h1 {{
                    font-size: 26px;
                    font-weight: 700;
                    margin: 0;
                    letter-spacing: -0.02em;
                }}
                .header p {{
                    font-size: 14px;
                    margin-top: 8px;
                    color: #f7dce8;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                }}
                .content {{
                    padding: 34px 32px 30px;
                }}
                .content h2 {{
                    font-size: 23px;
                    line-height: 1.25;
                    letter-spacing: -0.02em;
                }}
                .content h3 {{
                    color: #3b213f;
                    font-size: 16px;
                }}
                .info-box {{
                    background: #fbf8fb;
                    border: 1px solid #eaddea;
                    border-left: 5px solid #9b5aa2;
                    padding: 18px;
                    margin: 22px 0;
                    border-radius: 16px;
                }}
                .info-row {{
                    display: flex;
                    justify-content: space-between;
                    gap: 16px;
                    padding: 10px 0;
                    border-bottom: 1px solid #eaddea;
                }}
                .info-row:last-child {{
                    border-bottom: none;
                }}
                .info-label {{
                    font-weight: 600;
                    color: #6d5b73;
                    font-size: 13px;
                }}
                .info-value {{
                    color: #27212e;
                    font-weight: 600;
                    text-align: right;
                }}
                .button {{
                    display: inline-block;
                    padding: 13px 26px;
                    background: linear-gradient(135deg, #7d4586 0%, #b86a91 100%);
                    color: #ffffff !important;
                    text-decoration: none;
                    border-radius: 999px;
                    font-weight: 700;
                    margin: 22px 0;
                    text-align: center;
                    box-shadow: 0 10px 20px rgba(125, 69, 134, 0.22);
                }}
                .button:hover {{
                    opacity: 0.9;
                }}
                .footer {{
                    background-color: #faf7fa;
                    padding: 22px 28px;
                    text-align: center;
                    font-size: 12px;
                    color: #7b6b80;
                    border-top: 1px solid #eaddea;
                }}
                .alert {{
                    padding: 16px;
                    margin: 22px 0;
                    border-radius: 14px;
                    font-size: 14px;
                }}
                .alert-warning {{
                    background-color: #fff7e7;
                    border-left: 5px solid #f0a020;
                    color: #7a4a00;
                }}
                .alert-success {{
                    background-color: #eefaf2;
                    border-left: 5px solid #34a853;
                    color: #1d6b34;
                }}
                .alert-info {{
                    background-color: #f1f4ff;
                    border-left: 5px solid #6c7ae0;
                    color: #303b87;
                }}
                .muted {{
                    color: #7b6b80;
                    font-size: 13px;
                }}
                .email-context {{
                    margin-bottom: 24px;
                    padding-bottom: 18px;
                    border-bottom: 1px solid #eaddea;
                }}
                .audience-badge {{
                    display: inline-block;
                    padding: 6px 11px;
                    border-radius: 999px;
                    font-size: 11px;
                    font-weight: 800;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    margin-bottom: 12px;
                }}
                .audience-cliente {{
                    background: #f8e8f1;
                    color: #7d2756;
                }}
                .audience-profesional {{
                    background: #eef1ff;
                    color: #354196;
                }}
                .audience-propietario {{
                    background: #fff0dc;
                    color: #8a4a00;
                }}
                .audience-usuario {{
                    background: #eefaf2;
                    color: #1d6b34;
                }}
                .email-subject-label {{
                    color: #8a7b90;
                    display: block;
                    font-size: 11px;
                    font-weight: 800;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    margin-bottom: 4px;
                }}
                .email-subject {{
                    color: #3b213f;
                    font-size: 18px;
                    font-weight: 800;
                    line-height: 1.3;
                }}
                @media only screen and (max-width: 600px) {{
                    .wrapper {{
                        padding: 0;
                    }}
                    .container {{
                        margin: 0;
                        border-radius: 0;
                        border-left: none;
                        border-right: none;
                    }}
                    .header {{
                        padding: 28px 20px 24px;
                    }}
                    .content {{
                        padding: 26px 18px;
                    }}
                    .info-row {{
                        flex-direction: column;
                        gap: 4px;
                    }}
                    .info-value {{
                        text-align: left;
                    }}
                }}
            </style>
        </head>
        <body>
            <div class="wrapper">
                <div class="container">
                    <div class="header">
                        <h1>{header_titulo}</h1>
                        <p>Beautiful Studio</p>
                    </div>
                    <div class="content">
                        {contenido}
                    </div>
                    <div class="footer">
                        <p><strong>Beautiful Studio</strong></p>
                        <p>&copy; {anio} Beautiful Studio. Todos los derechos reservados.</p>
                        <p>Este es un email automático, por favor no responder.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        return template.replace("{anio}", str(timezone.now().year))

    @staticmethod
    def _email_context(destinatario: str, asunto: str) -> str:
        """Bloque visible para identificar destinatario y asunto dentro del email."""
        destinatario_limpio = (destinatario or "usuario").strip().lower()
        asunto_limpio = asunto or "Notificación de Beautiful Studio"
        return f"""
            <div class="email-context">
                <span class="audience-badge audience-{destinatario_limpio}">Para {destinatario_limpio}</span>
                <span class="email-subject-label">Asunto</span>
                <div class="email-subject">{asunto_limpio}</div>
            </div>
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
                {EmailService._email_context('profesional', 'Tenés un nuevo turno asignado')}
                <h2 style="color: #7d4586; margin-bottom: 20px;">Tenés un nuevo turno asignado</h2>
                
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
                subject=f"Hola {turno.empleado.user.first_name or turno.empleado.user.username}, tenés un nuevo turno",
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
                {EmailService._email_context('cliente', 'Tu turno está confirmado')}
                <h2 style="color: #7d4586; margin-bottom: 20px;">Tu turno está confirmado</h2>
                
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
                {EmailService._email_context('propietario', 'Nuevo turno registrado en el sistema')}
                <h2 style="color: #7d4586; margin-bottom: 20px;">Se registró un nuevo turno</h2>
                
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
                
                <p style="margin-top: 20px;">Podés revisar todos los detalles desde tu panel de control.</p>
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
                {EmailService._email_context('cliente', 'Tenés crédito disponible para tu próximo turno')}
                <h2 style="color: #7d4586; margin-bottom: 20px;">Te extrañamos en Beautiful Studio</h2>

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

                <p style="margin-top: 16px;">Podés usar ese crédito para reservar tu próximo turno ahora mismo:</p>

                <div style="text-align: center;">
                    <a href="{url_reserva}" class="button">Reservar mi turno</a>
                </div>

                <p style="margin-top: 12px; font-size: 13px; color: #6c757d;">
                    Si ya utilizaste tu crédito recientemente, podés ignorar este mensaje.
                </p>
            """

            html_message = EmailService._get_base_template().format(
                titulo="Te extrañamos en Beautiful Studio",
                header_titulo="Tenés crédito disponible",
                contenido=contenido,
            )

            plain_message = strip_tags(html_message)

            email_destino = EmailService._get_email_destinatario(cliente.user.email)

            send_mail(
                subject="Tenés crédito disponible para tu próximo turno",
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
                precio_original = Decimal(servicio.precio)
                descuento_monto = Decimal(str(getattr(servicio, "descuento_fidelizacion_monto", None) or 0))
                descuento_pct = Decimal(str(
                    servicio.descuento_fidelizacion_pct
                    or config_global.descuento_fidelizacion_pct
                    or 0
                ))
                if descuento_monto > 0:
                    precio_con_descuento = max(Decimal("0"), precio_original - descuento_monto)
                    beneficio_texto = f"${float(descuento_monto):.2f} de descuento"
                else:
                    precio_con_descuento = precio_original * (
                        Decimal("1.0") - descuento_pct / Decimal("100")
                    )
                    beneficio_texto = f"{float(descuento_pct):.0f}% de descuento"
                senia_promocional = (precio_con_descuento / Decimal("2")).quantize(Decimal("0.01"))
            except Exception:
                precio_original = servicio.precio
                precio_con_descuento = precio_original
                senia_promocional = precio_original
                beneficio_texto = "un beneficio especial"

            nombre_cliente = cliente.user.first_name or getattr(
                cliente, "nombre_completo", "Cliente"
            )
            nombre_profesional = empleado.user.get_full_name()

            contenido = f"""
                {EmailService._email_context('cliente', 'Tenés un beneficio especial en tu próximo turno')}
                <h2 style="color: #7d4586; margin-bottom: 20px;">Tenemos un beneficio especial para vos</h2>

                <p>Hola <strong>{nombre_cliente}</strong>,</p>
                <p>
                    Hace un tiempo que no nos visitás. Para agradecerte por haber
                    confiado en nosotros, queremos ofrecerte un
                    <strong>{beneficio_texto}</strong> en tu próximo
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
                        <span class="info-label">Total con beneficio:</span>
                        <span class="info-value">${float(precio_con_descuento):.2f}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Seña para reservar:</span>
                        <span class="info-value">${float(senia_promocional):.2f}</span>
                    </div>
                </div>

                <p style="margin-top: 16px;">
                    Podés aprovechar este beneficio desde el siguiente enlace. Si aceptás la oferta, el turno queda pendiente y lo pagás el día de la visita.
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
    def enviar_email_cupon_racha(coupon) -> bool:
        """Envía al cliente el código único de cupón por racha."""

        try:
            cliente = coupon.cliente
            if not getattr(cliente, "user", None) or not cliente.user.email:
                logger.warning("Cliente sin email para cupón de racha")
                return False

            nombre_cliente = cliente.user.first_name or getattr(cliente, "nombre_completo", "Cliente")
            expires_text = (
                coupon.expires_at.strftime("%d/%m/%Y")
                if coupon.expires_at
                else "la fecha indicada en tu cuenta"
            )

            contenido = f"""
                {EmailService._email_context('cliente', 'Tu código de descuento por racha')}
                <h2 style="color: #7d4586; margin-bottom: 20px;">Tu cupón de racha está listo</h2>

                <p>Hola <strong>{nombre_cliente}</strong>,</p>
                <p>
                    Alcanzaste una nueva racha de turnos completados y desbloqueaste
                    un cupón de descuento para tu próxima reserva.
                </p>

                <div class="info-box">
                    <div class="info-row">
                        <span class="info-label">Código:</span>
                        <span class="info-value" style="font-size: 20px; letter-spacing: 1px;">{coupon.code}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Descuento:</span>
                        <span class="info-value">${float(coupon.discount_amount):.2f}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Válido hasta:</span>
                        <span class="info-value">{expires_text}</span>
                    </div>
                </div>

                <p style="margin-top: 16px;">
                    No compartas este código. Es personal, de uso único y se marca como usado
                    cuando confirmás el pago de la reserva.
                </p>
            """

            html_message = EmailService._get_base_template().format(
                titulo="Tu cupón de racha",
                header_titulo="Cupón de fidelidad",
                contenido=contenido,
            )
            plain_message = strip_tags(html_message)
            email_destino = EmailService._get_email_destinatario(cliente.user.email)

            send_mail(
                subject="Tu código de descuento por racha",
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email_destino],
                html_message=html_message,
                fail_silently=False,
            )

            logger.info(
                "Email de cupón de racha enviado a %s (original: %s)",
                email_destino,
                cliente.user.email,
            )
            return True
        except Exception as e:
            logger.error("Error enviando email de cupón de racha: %s", e)
            return False

    @staticmethod
    def enviar_email_pago_pendiente_profesional(turno) -> bool:
        """
        Envía email al profesional notificando pago pendiente de un turno
        """
        try:
            contenido = f"""
                {EmailService._email_context('profesional', f'Pago pendiente - {turno.cliente.nombre_completo}')}
                <h2 style="color: #7d4586; margin-bottom: 20px;">Turno pendiente de pago</h2>
                
                <p>Hola <strong>{turno.empleado.user.get_full_name()}</strong>,</p>
                
                <div class="alert alert-warning">
                    <strong>Atención:</strong> tenés un turno completado pendiente de pago.
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
                {EmailService._email_context('profesional', 'Turno cancelado - ' + turno.fecha_hora.strftime('%d/%m/%Y %H:%M'))}
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

            # Email al cliente
            if getattr(turno, "cliente", None) and getattr(turno.cliente, "user", None) and turno.cliente.user.email:
                nombre_cliente = (
                    turno.cliente.user.first_name
                    or turno.cliente.user.get_full_name()
                    or turno.cliente.user.username
                )
                contenido_cliente = f"""
                    {EmailService._email_context('cliente', 'Tu turno en Beautiful Studio fue cancelado')}
                    <h2 style="color: #7d4586; margin-bottom: 20px;">Tu turno fue cancelado</h2>

                    <p>Hola <strong>{nombre_cliente}</strong>,</p>

                    <div class="alert alert-warning">
                        Te avisamos que tu turno fue cancelado. Abajo tenés el detalle del turno afectado.
                    </div>

                    <div class="info-box">
                        <div class="info-row">
                            <span class="info-label">Servicio:</span>
                            <span class="info-value">{turno.servicio.nombre}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Profesional:</span>
                            <span class="info-value">{turno.empleado.user.get_full_name()}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Fecha y hora:</span>
                            <span class="info-value">{turno.fecha_hora.strftime('%d/%m/%Y %H:%M')}</span>
                        </div>
                    </div>

                    <p>
                        Si querés reservar un nuevo horario, podés hacerlo desde tu panel de cliente.
                        Si tenías una seña o pago asociado, revisaremos el caso según la política del servicio.
                    </p>
                """

                html_message_cliente = EmailService._get_base_template().format(
                    titulo="Turno Cancelado",
                    header_titulo="Turno cancelado",
                    contenido=contenido_cliente,
                )

                email_cliente = EmailService._get_email_destinatario(turno.cliente.user.email)

                send_mail(
                    subject="Tu turno en Beautiful Studio fue cancelado",
                    message=strip_tags(html_message_cliente),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email_cliente],
                    html_message=html_message_cliente,
                    fail_silently=False,
                )

            # Email al propietario
            from apps.users.models import User

            propietarios = User.objects.filter(role="propietario")

            if propietarios.exists():
                contenido_propietario = f"""
                    {EmailService._email_context('propietario', f'Turno cancelado - {turno.empleado.user.get_full_name()}')}
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

                from apps.emails.models import NotificacionConfig

                emails_propietarios = []
                for propietario in propietarios:
                    config_prop, _ = NotificacionConfig.objects.get_or_create(user=propietario)
                    if config_prop.email_cancelacion_turno and propietario.email:
                        emails_propietarios.append(propietario.email)

                if not emails_propietarios:
                    emails_dest = []
                elif settings.DEBUG:
                    emails_dest = ["gimenezivanb@gmail.com"]
                else:
                    emails_dest = emails_propietarios

                if emails_dest:
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
                {EmailService._email_context('profesional', 'Un turno asignado fue modificado')}
                <h2 style="color: #7d4586; margin-bottom: 20px;">Turno modificado</h2>
                
                <p>Hola <strong>{turno.empleado.user.get_full_name()}</strong>,</p>
                
                <div class="alert alert-info">
                    Se modificó un turno asignado a vos.
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
    def enviar_email_modificacion_turno_cliente(turno, cambios: Dict) -> bool:
        """Envía email al cliente cuando se modifica su turno."""
        try:
            cambios_html = ""
            for campo, valores in cambios.items():
                cambios_html += f"""
                    <div class="info-row">
                        <span class="info-label">{campo}:</span>
                        <span class="info-value">{valores['anterior']} → {valores['nuevo']}</span>
                    </div>
                """

            nombre_cliente = (
                turno.cliente.user.first_name
                or turno.cliente.user.get_full_name()
                or turno.cliente.user.username
            )

            contenido = f"""
                {EmailService._email_context('cliente', 'Tu turno fue modificado')}
                <h2 style="color: #7d4586; margin-bottom: 20px;">Tu turno fue actualizado</h2>

                <p>Hola <strong>{nombre_cliente}</strong>,</p>

                <div class="alert alert-info">
                    Hubo una modificación en tu turno. Revisá los nuevos datos a continuación.
                </div>

                <h3 style="margin-top: 20px;">Cambios realizados:</h3>
                <div class="info-box">
                    {cambios_html}
                </div>

                <h3 style="margin-top: 20px;">Información del turno:</h3>
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
                </div>
            """

            html_message = EmailService._get_base_template().format(
                titulo="Turno Modificado",
                header_titulo="Turno Modificado",
                contenido=contenido,
            )

            plain_message = strip_tags(html_message)

            email_destino = EmailService._get_email_destinatario(turno.cliente.user.email)

            send_mail(
                subject=f'Tu turno fue modificado - {turno.fecha_hora.strftime("%d/%m/%Y %H:%M")}',
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email_destino],
                html_message=html_message,
                fail_silently=False,
            )

            logger.info(
                f"Email de modificación enviado a cliente {email_destino} (original: {turno.cliente.user.email})"
            )
            return True

        except Exception as e:
            logger.error(f"Error enviando email de modificación al cliente: {str(e)}")
            return False

    @staticmethod
    def enviar_email_recordatorio_turno(turno) -> bool:
        """
        Envía email recordatorio al profesional sobre un turno próximo
        """
        try:
            contenido = f"""
                {EmailService._email_context('profesional', 'Recordatorio de agenda')}
                <h2 style="color: #7d4586; margin-bottom: 20px;">Recordatorio de turno</h2>
                
                <p>Hola <strong>{turno.empleado.user.get_full_name()}</strong>,</p>
                
                <div class="alert alert-info">
                    <strong>Recordatorio:</strong> tenés un turno programado próximamente.
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
    def enviar_email_recordatorio_turno_cliente(turno) -> bool:
        """Envía email recordatorio al cliente sobre un turno próximo."""
        try:
            if not getattr(turno, "cliente", None) or not getattr(turno.cliente, "user", None):
                logger.warning("Turno %s sin cliente/usuario para recordatorio", turno.id)
                return False

            if not turno.cliente.user.email:
                logger.warning("Cliente %s sin email para recordatorio", turno.cliente.id)
                return False

            nombre_cliente = (
                turno.cliente.user.first_name
                or turno.cliente.user.get_full_name()
                or turno.cliente.user.username
            )

            contenido = f"""
                {EmailService._email_context('cliente', 'Recordatorio: tenés un turno en Beautiful Studio')}
                <h2 style="color: #7d4586; margin-bottom: 20px;">Te esperamos pronto</h2>

                <p>Hola <strong>{nombre_cliente}</strong>,</p>
                <p>Te recordamos que tenés un turno programado en Beautiful Studio.</p>

                <div class="info-box">
                    <div class="info-row">
                        <span class="info-label">Servicio:</span>
                        <span class="info-value">{turno.servicio.nombre}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Profesional:</span>
                        <span class="info-value">{turno.empleado.user.get_full_name()}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Fecha y hora:</span>
                        <span class="info-value">{turno.fecha_hora.strftime('%d/%m/%Y %H:%M')}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Duración estimada:</span>
                        <span class="info-value">{turno.servicio.duracion_minutos} minutos</span>
                    </div>
                </div>

                <div class="alert alert-info">
                    Te recomendamos llegar unos minutos antes para que podamos recibirte con tranquilidad.
                </div>

                <p class="muted">
                    Si necesitás cancelar o reprogramar, hacelo con anticipación desde tu cuenta o contactanos por los canales habituales del salón.
                </p>
            """

            html_message = EmailService._get_base_template().format(
                titulo="Recordatorio de Turno",
                header_titulo="Recordatorio de turno",
                contenido=contenido,
            )

            email_destino = EmailService._get_email_destinatario(turno.cliente.user.email)

            send_mail(
                subject="Recordatorio: tenés un turno en Beautiful Studio",
                message=strip_tags(html_message),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email_destino],
                html_message=html_message,
                fail_silently=False,
            )

            logger.info(
                "Email recordatorio enviado a cliente %s (original: %s)",
                email_destino,
                turno.cliente.user.email,
            )
            return True

        except Exception as e:
            logger.error("Error enviando email recordatorio al cliente: %s", str(e))
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
                {EmailService._email_context('propietario', 'Reporte diario - Beautiful Studio')}
                <h2 style="color: #7d4586; margin-bottom: 20px;">Resumen diario de actividad</h2>
                
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
    def enviar_emails_reacomodamiento_confirmado(
        *,
        turno_nuevo,
        turno_anterior,
        monto_descuento=0,
        monto_credito_billetera=0,
    ) -> bool:
        """Envía el resumen final cuando un cliente acepta un reacomodamiento."""
        try:
            from decimal import Decimal
            from apps.emails.models import NotificacionConfig
            from apps.users.models import User

            descuento = Decimal(str(monto_descuento or 0))
            credito = Decimal(str(monto_credito_billetera or 0))
            hubo_beneficio = descuento > 0 or credito > 0

            cliente = turno_nuevo.cliente
            profesional_user = turno_nuevo.empleado.user
            cliente_user = cliente.user
            cliente_nombre = cliente.nombre_completo
            servicio_nombre = turno_nuevo.servicio.nombre
            fecha_anterior = timezone.localtime(turno_anterior.fecha_hora).strftime("%d/%m/%Y %H:%M")
            fecha_nueva = timezone.localtime(turno_nuevo.fecha_hora).strftime("%d/%m/%Y %H:%M")

            enviados = 0

            if cliente_user and cliente_user.email:
                contenido_cliente = f"""
                    {EmailService._email_context('cliente', 'Tu turno fue reacomodado correctamente')}
                    <h2 style="color: #7d4586; margin-bottom: 20px;">Tu turno fue reacomodado</h2>

                    <p>Hola <strong>{cliente_user.first_name or cliente_user.username}</strong>,</p>
                    <p>Aceptaste la propuesta de reacomodamiento y tu turno quedó confirmado en el nuevo horario.</p>

                    <div class="info-box">
                        <div class="info-row"><span class="info-label">Servicio:</span><span class="info-value">{servicio_nombre}</span></div>
                        <div class="info-row"><span class="info-label">Profesional:</span><span class="info-value">{profesional_user.get_full_name()}</span></div>
                        <div class="info-row"><span class="info-label">Turno anterior:</span><span class="info-value">{fecha_anterior}</span></div>
                        <div class="info-row"><span class="info-label">Nuevo turno:</span><span class="info-value">{fecha_nueva}</span></div>
                        {f'<div class="info-row"><span class="info-label">Descuento aplicado:</span><span class="info-value">${descuento}</span></div>' if descuento > 0 else ''}
                        {f'<div class="info-row"><span class="info-label">Crédito en billetera:</span><span class="info-value">${credito}</span></div>' if credito > 0 else ''}
                    </div>

                    <div class="alert alert-success">Tu turno anterior quedó cancelado automáticamente para evitar duplicados.</div>
                """
                html_cliente = EmailService._get_base_template().format(
                    titulo="Turno reacomodado",
                    header_titulo="Turno reacomodado",
                    contenido=contenido_cliente,
                )
                send_mail(
                    subject="Tu turno fue reacomodado correctamente",
                    message=strip_tags(html_cliente),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[EmailService._get_email_destinatario(cliente_user.email)],
                    html_message=html_cliente,
                    fail_silently=False,
                )
                enviados += 1

            if profesional_user and profesional_user.email:
                contenido_profesional = f"""
                    {EmailService._email_context('profesional', f'{cliente_nombre} reacomodó su turno')}
                    <h2 style="color: #7d4586; margin-bottom: 20px;">{cliente_nombre} reacomodó su turno</h2>

                    <p>Hola <strong>{profesional_user.get_full_name()}</strong>,</p>
                    <p>El cliente aceptó una propuesta de reacomodamiento. Este es el resumen final, no hace falta revisar estados intermedios.</p>

                    <div class="info-box">
                        <div class="info-row"><span class="info-label">Cliente:</span><span class="info-value">{cliente_nombre}</span></div>
                        <div class="info-row"><span class="info-label">Servicio:</span><span class="info-value">{servicio_nombre}</span></div>
                        <div class="info-row"><span class="info-label">Turno anterior del cliente:</span><span class="info-value">{fecha_anterior}</span></div>
                        <div class="info-row"><span class="info-label">Nuevo turno en tu agenda:</span><span class="info-value">{fecha_nueva}</span></div>
                    </div>
                """
                html_prof = EmailService._get_base_template().format(
                    titulo="Reacomodamiento confirmado",
                    header_titulo="Agenda actualizada",
                    contenido=contenido_profesional,
                )
                send_mail(
                    subject=f"{cliente_nombre} reacomodó su turno",
                    message=strip_tags(html_prof),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[EmailService._get_email_destinatario(profesional_user.email)],
                    html_message=html_prof,
                    fail_silently=False,
                )
                enviados += 1

            if hubo_beneficio:
                propietarios = User.objects.filter(role="propietario", email__isnull=False)
                emails_propietarios = []
                for propietario in propietarios:
                    config, _ = NotificacionConfig.objects.get_or_create(user=propietario)
                    if config.email_reporte_diario and propietario.email:
                        emails_propietarios.append(propietario.email)

                if emails_propietarios:
                    contenido_propietario = f"""
                        {EmailService._email_context('propietario', 'Reacomodamiento confirmado')}
                        <h2 style="color: #7d4586; margin-bottom: 20px;">Reacomodamiento confirmado</h2>

                        <p>Un cliente aceptó reacomodar su turno con beneficio económico aplicado.</p>

                        <div class="info-box">
                            <div class="info-row"><span class="info-label">Cliente:</span><span class="info-value">{cliente_nombre}</span></div>
                            <div class="info-row"><span class="info-label">Profesional:</span><span class="info-value">{profesional_user.get_full_name()}</span></div>
                            <div class="info-row"><span class="info-label">Servicio:</span><span class="info-value">{servicio_nombre}</span></div>
                            <div class="info-row"><span class="info-label">Turno anterior:</span><span class="info-value">{fecha_anterior}</span></div>
                            <div class="info-row"><span class="info-label">Nuevo turno:</span><span class="info-value">{fecha_nueva}</span></div>
                            {f'<div class="info-row"><span class="info-label">Descuento aplicado:</span><span class="info-value">${descuento}</span></div>' if descuento > 0 else ''}
                            {f'<div class="info-row"><span class="info-label">Crédito en billetera:</span><span class="info-value">${credito}</span></div>' if credito > 0 else ''}
                        </div>
                    """
                    html_prop = EmailService._get_base_template().format(
                        titulo="Reacomodamiento confirmado",
                        header_titulo="Reacomodamiento confirmado",
                        contenido=contenido_propietario,
                    )
                    destinatarios = [EmailService._get_email_destinatario(email) for email in emails_propietarios]
                    send_mail(
                        subject="Reacomodamiento confirmado",
                        message=strip_tags(html_prop),
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=destinatarios,
                        html_message=html_prop,
                        fail_silently=False,
                    )
                    enviados += len(destinatarios)

            logger.info("Emails de reacomodamiento confirmado enviados: %s", enviados)
            return enviados > 0
        except Exception as e:
            logger.error("Error enviando emails de reacomodamiento confirmado: %s", str(e))
            return False

    @staticmethod
    def enviar_email_oferta_reasignacion(
        turno_cancelado,
        turno_ofrecido,
        log_reasignacion,
        monto_final,
        monto_descuento,
        senia_pagada,
        monto_credito_billetera=0,
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

            promotion_offer = None
            try:
                from apps.emails.models import PromotionOffer

                promotion_offer = PromotionOffer.objects.filter(
                    reasignacion_log=log_reasignacion,
                    process_type=PromotionOffer.ProcessType.REACOMODAMIENTO,
                ).first()
            except Exception:
                promotion_offer = None

            # Link a la página de confirmación del frontend
            confirmar_url = (
                f"{base_url}/reacomodamiento/confirmar?token="
                f"{promotion_offer.token if promotion_offer else log_reasignacion.token}"
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
            monto_credito_billetera = monto_credito_billetera or 0

            if cliente_pago_completo:
                titulo_email = "Reacomodo de turno disponible"
                header_titulo = "Reacomodo de turno"
                contenido = f"""
                    {EmailService._email_context('cliente', titulo_email)}
                    <h2 style="color: #7d4586; margin-bottom: 20px;">¡Se liberó un turno antes de tu fecha!</h2>

                    <p>Hola <strong>{turno_ofrecido.cliente.user.first_name or turno_ofrecido.cliente.user.username}</strong>,</p>
                    <p>Se liberó un turno para el mismo servicio y podemos reacomodarte a una fecha más cercana.</p>
                    <p><strong>Oferta por reacomodamiento: si aceptás, te acreditamos ${monto_credito_billetera} en tu billetera virtual.</strong></p>

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
                        <div class="info-row">
                            <span class="info-label">Oferta por reacomodamiento en billetera:</span>
                            <span class="info-value" style="color: #48bb78;"><strong>+${monto_credito_billetera}</strong></span>
                        </div>
                    </div>

                    <div class="alert alert-warning">
                        <strong>⏰ Importante:</strong> Esta propuesta expira el {expiracion_dt.strftime('%d/%m/%Y %H:%M')}.
                    </div>

                    <p style="text-align: center; margin: 30px 0;">
                        <a href="{confirmar_url}" class="button" style="font-size: 1.1em; padding: 15px 40px;">Ver detalles y confirmar reacomodo</a>
                    </p>

                    <p style="color: #718096; font-size: 0.9em; text-align: center;">
                        Si no querés adelantar tu turno, simplemente ignorá este email.<br>
                        Tu turno original se mantendrá sin cambios.
                    </p>
                """
            else:
                titulo_email = "Tenemos un turno antes para vos"
                header_titulo = "Oferta de turno"
                contenido = f"""
                    {EmailService._email_context('cliente', titulo_email)}
                    <h2 style="color: #7d4586; margin-bottom: 20px;">¡Se liberó un turno antes de tu fecha!</h2>

                    <p>Hola <strong>{turno_ofrecido.cliente.user.first_name or turno_ofrecido.cliente.user.username}</strong>,</p>
                    <p>Se liberó un turno para el mismo servicio y podemos adelantarte con una oferta por reacomodamiento.</p>

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
                            <span class="info-label">Oferta por reacomodamiento:</span>
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
                        Si no querés adelantar tu turno, simplemente ignorá este email.<br>
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
        email: str,
        token: str,
        usuario_nombre: str = "",
        es_creacion_cuenta: bool = False,
        validez_horas: int = 1,
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

            saludo = f"Hola <strong>{usuario_nombre}</strong>," if usuario_nombre else "Hola,"
            titulo = "Creá tu contraseña" if es_creacion_cuenta else "Recuperar contraseña"
            asunto = "Creá tu contraseña - Beautiful Studio" if es_creacion_cuenta else "Recuperar contraseña - Beautiful Studio"
            contexto = "Crear contraseña - Beautiful Studio" if es_creacion_cuenta else "Recuperar contraseña - Beautiful Studio"
            intro = (
                "Tu cuenta fue creada por el salón al registrar tu turno en <strong>Beautiful Studio</strong>."
                if es_creacion_cuenta
                else "Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>Beautiful Studio</strong>."
            )
            accion = (
                "Usá el siguiente botón para crear tu contraseña y poder ingresar al sistema:"
                if es_creacion_cuenta
                else "Usá el siguiente botón para crear una nueva contraseña:"
            )
            boton = "Crear contraseña" if es_creacion_cuenta else "Restablecer contraseña"
            contenido = f"""
                {EmailService._email_context('usuario', contexto)}
                <h2 style="color: #7d4586; margin-bottom: 20px;">{titulo}</h2>

                <p>{saludo}</p>
                <p style="margin-top: 14px;">
                    {intro}
                </p>

                <p style="margin-top: 14px;">{accion}</p>

                <div style="text-align: center;">
                    <a href="{reset_url}" class="button">{boton}</a>
                </div>

                <div class="alert alert-warning">
                    <strong>Importante:</strong> este enlace es válido por {validez_horas} horas, se puede usar una sola vez
                    y podés ignorar este email si no solicitaste el cambio.
                </div>

                <p class="muted" style="word-break: break-all;">
                    Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br>
                    <a href="{reset_url}" style="color: #7d4586;">{reset_url}</a>
                </p>
            """

            html_message = EmailService._get_base_template().format(
                titulo=titulo,
                header_titulo=titulo,
                contenido=contenido,
            )

            plain_message = strip_tags(html_message)

            # En DEBUG, enviar a Mailtrap
            email_dest = (
                EmailService._get_email_destinatario(email) if settings.DEBUG else email
            )

            send_mail(
                subject=asunto,
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
