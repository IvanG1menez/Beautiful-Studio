from decimal import Decimal
import logging

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags

from apps.emails.services import EmailService

logger = logging.getLogger(__name__)


def _calcular_descuento_y_precio(servicio):
    precio = Decimal(servicio.precio or 0)
    valor_descuento = Decimal(servicio.valor_descuento_adelanto or 0)

    if servicio.tipo_descuento_adelanto == "PORCENTAJE":
        descuento = (precio * valor_descuento) / Decimal("100")
    else:
        descuento = valor_descuento

    nuevo_precio = precio - descuento
    if nuevo_precio < 0:
        nuevo_precio = Decimal("0.00")

    return precio, descuento, nuevo_precio


def enviar_propuesta_reacomodamiento(turno_candidato, servicio) -> bool:
    try:
        if not turno_candidato.cliente or not turno_candidato.cliente.user:
            logger.warning("Turno candidato sin usuario asociado")
            return False

        cliente_user = turno_candidato.cliente.user

        if not cliente_user.email:
            logger.warning("Cliente sin email configurado para reacomodamiento")
            return False

        precio_original, descuento, nuevo_precio = _calcular_descuento_y_precio(
            servicio
        )

        if servicio.tipo_descuento_adelanto == "PORCENTAJE":
            beneficio = f"{servicio.valor_descuento_adelanto}% de descuento"
        else:
            beneficio = f"${servicio.valor_descuento_adelanto} de descuento"

        base_url = (
            getattr(settings, "FRONTEND_URL", None)
            or getattr(settings, "BACKEND_URL", None)
            or "http://localhost:3000"
        )
        confirmar_url = (
            f"{base_url}/reacomodamiento/confirmar?turno={turno_candidato.id}"
        )

        # Verificar si el cliente tiene saldo en su billetera
        saldo_disponible = Decimal("0.00")
        tiene_saldo = False
        try:
            from apps.clientes.models import Billetera

            billetera = Billetera.objects.get(cliente=turno_candidato.cliente)
            saldo_disponible = billetera.saldo
            tiene_saldo = saldo_disponible > 0
        except:
            pass

        context = {
            "nombre": cliente_user.first_name or cliente_user.username,
            "servicio_nombre": servicio.nombre,
            "beneficio": beneficio,
            "precio_original": precio_original,
            "descuento": descuento,
            "nuevo_precio": nuevo_precio,
            "confirmar_url": confirmar_url,
            "tiempo_espera": servicio.tiempo_espera_respuesta,
            "tiene_saldo": tiene_saldo,
            "saldo_disponible": saldo_disponible,
        }

        html_message = render_to_string(
            "emails/propuesta_reacomodamiento.html", context
        )
        plain_message = strip_tags(html_message)

        email_destino = EmailService._get_email_destinatario(cliente_user.email)

        send_mail(
            subject=f"Tenemos un lugar para vos en {servicio.nombre}",
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email_destino],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Email de propuesta de reacomodamiento enviado a {email_destino}")
        return True

    except Exception as e:
        logger.error(f"Error enviando propuesta de reacomodamiento: {str(e)}")
        return False
