"""
Lógica de negocio para Mercado Pago.

Toda la interacción con el SDK de MP vive aquí para mantener las vistas limpias.
"""

import json
import logging

import mercadopago
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def _get_sdk(access_token: str | None = None) -> mercadopago.SDK:
    """Crea el SDK con el token indicado y valida configuración mínima."""
    access_token = (access_token or getattr(settings, "MP_ACCESS_TOKEN", "") or "").strip()
    if not access_token:
        raise ValueError(
            "Configuración incompleta de Mercado Pago: falta MP_ACCESS_TOKEN en backend/.env"
        )
    return mercadopago.SDK(access_token)


def _get_qr_sdk() -> mercadopago.SDK:
    """Crea el SDK con las credenciales de QR presencial."""
    access_token = (
        getattr(settings, "MP_QR_ACCESS_TOKEN", "")
        or getattr(settings, "MP_ACCESS_TOKEN", "")
        or ""
    ).strip()
    return _get_sdk(access_token)


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
    sdk = _get_sdk()

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

    # Algunas cuentas/credenciales de MP rechazan la preferencia cuando se envía
    # payer.email (PolicyAgent). Reintentamos sin payer para no bloquear el flujo.
    response_body = response.get("response", {})
    if (
        response.get("status") == 403
        and response_body.get("blocked_by") == "PolicyAgent"
        and preference_data.get("payer")
    ):
        logger.warning(
            "MP rechazó preferencia con payer.email (%s). Reintentando sin payer.",
            response_body,
        )
        preference_data.pop("payer", None)
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
        "raw_init_point": data.get("init_point", ""),
        "raw_sandbox_init_point": data.get("sandbox_init_point", ""),
    }


def obtener_pago(payment_id: str, use_qr_credentials: bool = False) -> dict:
    """Consulta el estado de un pago por su payment_id."""
    sdk = _get_qr_sdk() if use_qr_credentials else _get_sdk()
    response = sdk.payment().get(payment_id)
    if response["status"] != 200:
        raise ValueError(
            f"No se pudo obtener el pago {payment_id}: {response.get('response', {})}"
        )
    return response["response"]


def obtener_orden(merchant_order_id: str, use_qr_credentials: bool = False) -> dict:
    """Consulta una merchant_order por su ID."""
    sdk = _get_qr_sdk() if use_qr_credentials else _get_sdk()
    response = sdk.merchant_order().get(merchant_order_id)
    if response["status"] != 200:
        raise ValueError(
            f"No se pudo obtener la orden {merchant_order_id}: {response.get('response', {})}"
        )
    return response["response"]


def obtener_preferencia(preference_id: str) -> dict:
    """Consulta una preferencia por su ID."""
    sdk = _get_sdk()
    response = sdk.preference().get(preference_id)
    if response["status"] != 200:
        raise ValueError(
            f"No se pudo obtener preferencia {preference_id}: {response.get('response', {})}"
        )
    return response["response"]


def _primer_pago_aprobado(results: list[dict], external_reference: str = "") -> dict | None:
    for pago in results:
        if pago.get("status") == "approved":
            if external_reference and not pago.get("external_reference"):
                pago["external_reference"] = external_reference
            return pago
    return None


def buscar_pago_aprobado_por_preference(preference_id: str) -> dict | None:
    """Busca pagos por preference_id y devuelve el primero aprobado."""
    sdk = _get_sdk()
    pref_resp = sdk.preference().get(preference_id)
    if pref_resp["status"] != 200:
        raise ValueError(
            f"No se pudo obtener preferencia {preference_id}: {pref_resp.get('response', {})}"
        )

    external_reference = pref_resp.get("response", {}).get("external_reference", "")

    search_attempts = [
        ("preference_id", {"preference_id": preference_id}),
    ]
    if external_reference:
        search_attempts.append(("external_reference", {"external_reference": external_reference}))

    last_error = None
    for search_name, search_filter in search_attempts:
        response = sdk.payment().search(
            {
                "sort": "date_created",
                "criteria": "desc",
                "limit": 10,
                "offset": 0,
                **search_filter,
            }
        )

        if response["status"] != 200:
            last_error = response.get("response", {})
            logger.warning(
                "MP search por %s falló para preference_id=%s: %s",
                search_name,
                preference_id,
                last_error,
            )
            continue

        pago_aprobado = _primer_pago_aprobado(
            response.get("response", {}).get("results", []),
            external_reference=external_reference,
        )
        if pago_aprobado:
            return pago_aprobado

    if last_error and not external_reference:
        raise ValueError(
            f"No se pudo buscar pagos de preference_id {preference_id}: {last_error}"
        )
    return None


def buscar_ultimo_pago_por_preference(preference_id: str) -> dict | None:
    """Busca el pago más reciente asociado a una preferencia, aprobado o no."""
    sdk = _get_sdk()
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
            "limit": 1,
            "offset": 0,
            "external_reference": external_reference,
        }
    )
    if response["status"] != 200:
        raise ValueError(
            f"No se pudo buscar último pago de external_reference {external_reference}: {response.get('response', {})}"
        )
    results = response.get("response", {}).get("results", [])
    return results[0] if results else None


def crear_orden_qr_dinamico(
    collector_id: str,
    external_pos_id: str,
    reference_id: str,
    titulo: str,
    descripcion: str,
    monto: float,
    notification_url: str = "",
    sponsor_id: int | None = None,
    cash_out_amount: float = 0.0,
) -> dict:
    """Crea una orden QR dinámica nativa para lector de Mercado Pago."""
    access_token = (
        getattr(settings, "MP_QR_ACCESS_TOKEN", "")
        or getattr(settings, "MP_ACCESS_TOKEN", "")
        or ""
    ).strip()
    if not access_token:
        raise ValueError(
            "Configuración incompleta de Mercado Pago: falta MP_QR_ACCESS_TOKEN o MP_ACCESS_TOKEN"
        )
    if not str(collector_id).strip():
        raise ValueError("Configuración incompleta de Mercado Pago: falta MP_QR_COLLECTOR_ID")
    if not str(external_pos_id).strip():
        raise ValueError("Configuración incompleta de Mercado Pago: falta MP_QR_POS_EXTERNAL_ID")

    url = (
        "https://api.mercadopago.com/instore/orders/qr/seller/collectors/"
        f"{collector_id}/pos/{external_pos_id}/qrs"
    )
    payload = {
        "external_reference": reference_id,
        "title": titulo,
        "description": descripcion,
        "total_amount": float(monto),
        "items": [
            {
                "sku_number": reference_id[:32],
                "category": "services",
                "title": titulo,
                "description": descripcion,
                "unit_price": float(monto),
                "quantity": 1,
                "unit_measure": "unit",
                "total_amount": float(monto),
            }
        ],
    }
    if sponsor_id:
        payload["sponsor"] = {"id": int(sponsor_id)}
    if cash_out_amount:
        payload["cash_out"] = {"amount": float(cash_out_amount)}
    if notification_url:
        payload["notification_url"] = notification_url

    response = requests.put(
        url,
        headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
        json=payload,
        timeout=20,
    )
    if response.status_code not in (200, 201):
        raise ValueError(f"Mercado Pago rechazó la orden QR: {response.status_code} {response.text}")
    return response.json()


def crear_pos_qr(
    name: str,
    external_id: str,
    store_id: str = "",
    external_store_id: str = "",
    fixed_amount: bool = False,
    category: int = 621102,
) -> dict:
    """Crea una caja/POS de Mercado Pago para QR presencial."""
    access_token = (
        getattr(settings, "MP_QR_ACCESS_TOKEN", "")
        or getattr(settings, "MP_ACCESS_TOKEN", "")
        or ""
    ).strip()
    if not access_token:
        raise ValueError("Falta MP_QR_ACCESS_TOKEN o MP_ACCESS_TOKEN")
    if not external_id or not external_id.isalnum():
        raise ValueError("MP_QR_POS_EXTERNAL_ID debe ser alfanumérico, sin espacios ni guiones")
    if not store_id and not external_store_id:
        raise ValueError("Falta MP_QR_STORE_ID o MP_QR_EXTERNAL_STORE_ID para crear el POS")

    payload: dict = {
        "name": name[:44],
        "fixed_amount": fixed_amount,
        "external_id": external_id,
        "category": category,
    }
    if store_id:
        payload["store_id"] = int(store_id)
    elif external_store_id:
        payload["external_store_id"] = external_store_id

    response = requests.post(
        "https://api.mercadopago.com/pos",
        headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
        json=payload,
        timeout=20,
    )
    if response.status_code in (200, 201):
        return response.json()
    if response.status_code == 409 or (
        response.status_code == 400 and "already assigned" in response.text
    ):
        return {"status": "exists", "detail": response.text, "external_id": external_id}
    raise ValueError(f"Mercado Pago rechazó la creación del POS: {response.status_code} {response.text}")


def crear_store_qr(
    collector_id: str,
    name: str,
    external_id: str,
    street_name: str,
    street_number: str,
    city_name: str,
    state_name: str,
    latitude: str,
    longitude: str,
    reference: str = "",
) -> dict:
    """Crea una sucursal física para QR presencial."""
    access_token = (
        getattr(settings, "MP_QR_ACCESS_TOKEN", "")
        or getattr(settings, "MP_ACCESS_TOKEN", "")
        or ""
    ).strip()
    if not access_token:
        raise ValueError("Falta MP_QR_ACCESS_TOKEN o MP_ACCESS_TOKEN")
    if not collector_id:
        raise ValueError("Falta MP_QR_COLLECTOR_ID")
    if not external_id:
        raise ValueError("Falta MP_QR_EXTERNAL_STORE_ID")

    payload = {
        "name": name,
        "external_id": external_id,
        "business_hours": {
            "monday": [{"open": "09:00", "close": "18:00"}],
            "tuesday": [{"open": "09:00", "close": "18:00"}],
            "wednesday": [{"open": "09:00", "close": "18:00"}],
            "thursday": [{"open": "09:00", "close": "18:00"}],
            "friday": [{"open": "09:00", "close": "18:00"}],
            "saturday": [{"open": "09:00", "close": "13:00"}],
        },
        "location": {
            "street_name": street_name,
            "street_number": street_number,
            "city_name": city_name,
            "state_name": state_name,
            "latitude": float(latitude),
            "longitude": float(longitude),
            "reference": reference or name,
        },
    }

    response = requests.post(
        f"https://api.mercadopago.com/users/{collector_id}/stores",
        headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
        json=payload,
        timeout=20,
    )
    if response.status_code in (200, 201):
        return response.json()
    if response.status_code == 409:
        return {"status": "exists", "detail": response.text, "external_id": external_id}
    raise ValueError(f"Mercado Pago rechazó la creación de la sucursal: {response.status_code} {response.text}")


def buscar_pago_aprobado_por_external_reference(
    external_reference: str,
    use_qr_credentials: bool = False,
) -> dict | None:
    """Busca pagos por external_reference y devuelve el primero aprobado."""
    sdk = _get_qr_sdk() if use_qr_credentials else _get_sdk()
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
            f"No se pudo buscar pagos de external_reference {external_reference}: {response.get('response', {})}"
        )
    return _primer_pago_aprobado(response.get("response", {}).get("results", []), external_reference=external_reference)


def buscar_orden_aprobada_por_external_reference(
    external_reference: str,
    use_qr_credentials: bool = False,
) -> dict | None:
    """Busca merchant orders por external_reference y devuelve una con pago aprobado."""
    sdk = _get_qr_sdk() if use_qr_credentials else _get_sdk()
    response = sdk.merchant_order().search(
        {
            "external_reference": external_reference,
            "sort": "date_created",
            "criteria": "desc",
            "limit": 10,
            "offset": 0,
        }
    )
    if response["status"] != 200:
        raise ValueError(
            f"No se pudo buscar órdenes de external_reference {external_reference}: {response.get('response', {})}"
        )

    elements = response.get("response", {}).get("elements", [])
    for orden in elements:
        pagos = orden.get("payments", [])
        if any(pago.get("status") == "approved" for pago in pagos):
            return orden
    return None
