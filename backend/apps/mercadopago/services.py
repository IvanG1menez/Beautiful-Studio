"""
Lógica de negocio para Mercado Pago.

Toda la interacción con el SDK de MP vive aquí para mantener las vistas limpias.
"""

import json
import logging

import mercadopago
from django.conf import settings

logger = logging.getLogger(__name__)

# Instancia única del SDK (reutilizada en toda la app)
sdk = mercadopago.SDK(settings.MP_ACCESS_TOKEN)


def crear_preferencia(
    titulo: str,
    descripcion: str,
    monto: float,
    cantidad: int = 1,
    external_reference: str = "",
    notification_url: str = "",
    back_urls: dict | None = None,
    auto_return: str = "approved",
    payer_email: str = "",
) -> dict:
    """
    Crea una preferencia de pago en Mercado Pago.

    Devuelve un dict con:
        preference_id, init_point, sandbox_init_point
    """
    # Usar las URLs de retorno específicas de MP si están configuradas,
    # con fallback a FRONTEND_URL. Estas pueden apuntar a la URL pública (ngrok/prod).
    back_urls_final = back_urls or {
        "success": getattr(
            settings, "MERCADO_PAGO_SUCCESS_URL", "http://localhost:3000/pago-exitoso"
        ),
        "failure": getattr(
            settings, "MERCADO_PAGO_FAILURE_URL", "http://localhost:3000/pago-fallido"
        ),
        "pending": getattr(
            settings, "MERCADO_PAGO_PENDING_URL", "http://localhost:3000/pago-pendiente"
        ),
    }

    preference_data: dict = {
        "items": [
            {
                "title": titulo,
                "description": descripcion,
                "quantity": cantidad,
                "unit_price": float(monto),
                "currency_id": getattr(settings, "MP_CURRENCY_ID", "ARS"),
            }
        ],
        "external_reference": str(external_reference),
        "back_urls": back_urls_final,
    }

    # auto_return solo es válido cuando la URL de éxito NO es localhost.
    # MP rechaza la preferencia si back_urls.success no es públicamente accesible.
    success_url = back_urls_final.get("success", "")
    is_localhost = "localhost" in success_url or "127.0.0.1" in success_url
    if auto_return and not is_localhost:
        preference_data["auto_return"] = auto_return

    if notification_url:
        preference_data["notification_url"] = notification_url

    if payer_email:
        preference_data["payer"] = {"email": payer_email}

    # Debug log
    logger.debug(
        "MP back_urls: %s | external_reference: %s | auto_return: %s",
        json.dumps(back_urls_final),
        external_reference,
        preference_data.get("auto_return", "omitido (localhost)"),
    )

    response = sdk.preference().create(preference_data)

    if response["status"] not in (200, 201):
        raise ValueError(
            f"Mercado Pago rechazó la preferencia: {response.get('response', {})}"
        )

    data = response["response"]
    return {
        "preference_id": data["id"],
        "init_point": data["init_point"],
        "sandbox_init_point": data.get("sandbox_init_point", data["init_point"]),
    }


def obtener_pago(payment_id: str) -> dict:
    """Consulta el estado de un pago por su payment_id."""
    response = sdk.payment().get(payment_id)
    if response["status"] != 200:
        raise ValueError(
            f"No se pudo obtener el pago {payment_id}: {response.get('response', {})}"
        )
    return response["response"]


def obtener_orden(merchant_order_id: str) -> dict:
    """Consulta una merchant_order por su ID."""
    response = sdk.merchant_order().get(merchant_order_id)
    if response["status"] != 200:
        raise ValueError(
            f"No se pudo obtener la orden {merchant_order_id}: {response.get('response', {})}"
        )
    return response["response"]


def buscar_pago_aprobado_por_preference(preference_id: str) -> dict | None:
    """Busca pagos por preference_id (vía external_reference) y devuelve el primero aprobado."""
    pref_resp = sdk.preference().get(preference_id)
    if pref_resp["status"] != 200:
        raise ValueError(
            f"No se pudo obtener preferencia {preference_id}: {pref_resp.get('response', {})}"
        )

    external_reference = pref_resp.get("response", {}).get("external_reference", "")
    if not external_reference:
        return None

    response = sdk.payment().search(
        {
            "sort": "date_created",
            "criteria": "desc",
            "limit": 10,
            "offset": 0,
            "external_reference": external_reference,
        }
    )

    if response["status"] != 200:
        raise ValueError(
            "No se pudo buscar pagos por external_reference de preference_id "
            f"{preference_id}: {response.get('response', {})}"
        )

    results = response.get("response", {}).get("results", [])
    for pago in results:
        if pago.get("status") == "approved":
            return pago
    return None
