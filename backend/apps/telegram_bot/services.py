import logging
import re
import unicodedata

import requests
from django.conf import settings
from django.utils import timezone

from apps.turnos.models import Turno
from apps.turnos.services.cancelacion_service import cancelar_turno_para_cliente

from .models import TelegramConversationState, TelegramLink

logger = logging.getLogger(__name__)


class TelegramBotService:
    API_BASE = "https://api.telegram.org"
    CANCEL_REASON_MAP = {
        "agenda": "Problema de agenda personal",
        "salud": "Motivos de salud",
        "laboral": "Compromiso laboral",
        "otro": "Otro motivo informado por el cliente",
    }
    GREETING_KEYWORDS = {
        "hola",
        "buenas",
        "buen dia",
        "buenos dias",
        "buenas tardes",
        "buenas noches",
        "menu",
        "menú",
        "inicio",
    }
    FAREWELL_KEYWORDS = {
        "chau",
        "chao",
        "adios",
        "adiós",
        "gracias",
        "hasta luego",
        "hasta pronto",
        "nos vemos",
        "finalizar",
        "finalizar chat",
    }

    def __init__(self):
        self.token = getattr(settings, "TELEGRAM_BOT_TOKEN", "")
        self.timeout = int(getattr(settings, "TELEGRAM_API_REQUEST_TIMEOUT", 10))

    def process_update(self, update):
        callback_query = update.get("callback_query")
        if callback_query:
            self._handle_callback_query(callback_query)
            return

        message = update.get("message")
        if message:
            self._handle_message(message)

    def _handle_message(self, message):
        chat_id = message.get("chat", {}).get("id")
        from_user = message.get("from", {})
        telegram_user_id = from_user.get("id")
        text = (message.get("text") or "").strip()
        contact = message.get("contact")

        if not chat_id or not telegram_user_id:
            return

        link, _ = TelegramLink.objects.get_or_create(
            telegram_user_id=telegram_user_id,
            defaults={"chat_id": chat_id},
        )
        if link.chat_id != chat_id:
            link.chat_id = chat_id
            link.save(update_fields=["chat_id", "last_seen_at"])

        if contact and contact.get("phone_number"):
            self._try_link_by_phone(link, contact.get("phone_number"))
            return

        state, _ = TelegramConversationState.objects.get_or_create(link=link)

        command = text.lower()

        if self._is_farewell(command):
            state.state = TelegramConversationState.STATE_IDLE
            state.pending_turno_id = None
            state.save(update_fields=["state", "pending_turno_id", "updated_at"])
            self.send_message(
                chat_id,
                "Gracias por escribirnos 💇‍♀️✨\nCuando quieras volver, mandame un \"hola\" o /start y seguimos.",
                reply_markup={"remove_keyboard": True},
            )
            return

        if command in {"/start", "/menu", "menu"}:
            if not link.is_verified:
                self._send_phone_link_instructions(chat_id)
            else:
                self.send_welcome_message(chat_id, link)
                self.send_main_menu(chat_id)
            return

        if not link.is_verified:
            if text:
                self._try_link_by_phone(link, text)
            else:
                self._send_phone_link_instructions(chat_id)
            return

        if self._handle_turno_modification_command(chat_id, link, text):
            return

        if command in {"consultar", "turnos", "mis turnos"}:
            self.send_turnos_list(chat_id, link)
            return

        if command in {"cancelar", "cancelar turno"}:
            self.send_turnos_for_cancel(chat_id, link)
            return

        if command in {"ayuda", "help"}:
            self.send_help(chat_id)
            return

        if command in {"estado", "mi estado", "vinculacion"}:
            self.send_account_status(chat_id, link)
            return

        if self._is_greeting(command) or (
            state.state == TelegramConversationState.STATE_IDLE and command
        ):
            self.send_message(
                chat_id,
                "¡Hola de nuevo! ✨\nQue lindo tenerte por aca. ¿Que queres hacer hoy?",
            )
            self.send_main_menu(chat_id)
            return

        self.send_main_menu(chat_id)

    def _handle_turno_modification_command(self, chat_id, link, text):
        """Procesa comandos de modificacion de turnos y aplica cambios en BD."""
        normalized = (text or "").strip()
        if not normalized:
            return False

        lowered = normalized.lower()
        if not (lowered.startswith("/modificar_turno") or lowered.startswith("modificar_turno")):
            return False

        parts = normalized.split()
        if len(parts) < 3:
            self.send_message(
                chat_id,
                "Uso: /modificar_turno cancelar <turno_id> [motivo]",
            )
            return True

        action = parts[1].lower()
        turno_id = self._safe_int(parts[2])
        if not turno_id:
            self.send_message(chat_id, "El turno_id es invalido.")
            return True

        turno = (
            Turno.objects.select_related("servicio", "cliente__user")
            .filter(id=turno_id, cliente=link.cliente)
            .first()
        )
        if not turno:
            self.send_message(chat_id, "No encontre ese turno para tu cuenta.")
            return True

        if action == "cancelar":
            motivo = " ".join(parts[3:]).strip() or "Cancelacion solicitada desde Telegram"
            try:
                result = cancelar_turno_para_cliente(
                    turno=turno,
                    usuario=link.cliente.user,
                    motivo=motivo,
                )
            except ValueError as exc:
                self.send_message(chat_id, f"No pude modificar el turno: {exc}")
                return True

            credit_line = (
                f"Credito aplicado: ${result.monto_credito:.2f}."
                if result.credito_aplicado
                else (
                    "Sin credito por ventana de cancelacion. "
                    f"Minimo requerido: {result.horas_antelacion_requerida}h."
                )
            )
            self.send_message(
                chat_id,
                f"Turno #{turno.id} cancelado correctamente. {credit_line}",
            )
            self.send_main_menu(chat_id)
            return True

        self.send_message(
            chat_id,
            "Accion no soportada. Disponible: /modificar_turno cancelar <turno_id> [motivo]",
        )
        return True

    def _handle_callback_query(self, callback_query):
        data = callback_query.get("data") or ""
        callback_id = callback_query.get("id")
        from_user = callback_query.get("from", {})
        chat_id = callback_query.get("message", {}).get("chat", {}).get("id")
        message_id = callback_query.get("message", {}).get("message_id")
        telegram_user_id = from_user.get("id")

        if not chat_id or not telegram_user_id:
            return

        link = TelegramLink.objects.filter(telegram_user_id=telegram_user_id).first()
        if not link:
            self.answer_callback_query(callback_id, "Inicia con /start")
            return

        # Evita que el usuario vuelva a tocar botones viejos del mismo mensaje.
        if chat_id and message_id:
            self.clear_inline_keyboard(chat_id, message_id)

        if data == "menu:list_turnos":
            self.send_turnos_list(chat_id, link)
            self.answer_callback_query(callback_id)
            return

        if data == "menu:cancel_turno":
            self.send_turnos_for_cancel(chat_id, link)
            self.answer_callback_query(callback_id)
            return

        if data == "menu:help":
            self.send_help(chat_id)
            self.answer_callback_query(callback_id)
            return

        if data == "menu:status":
            self.send_account_status(chat_id, link)
            self.answer_callback_query(callback_id)
            return

        if data == "menu:home":
            self.send_main_menu(chat_id)
            self.answer_callback_query(callback_id)
            return

        if data == "menu:end_chat":
            self.send_message(
                chat_id,
                "Gracias por escribirnos 💇‍♀️✨\nCuando quieras volver, mandame un \"hola\" y te ayudo con tus turnos.",
                reply_markup={"remove_keyboard": True},
            )
            self.answer_callback_query(callback_id)
            return

        if data == "followup:back":
            self.send_main_menu(chat_id)
            self.answer_callback_query(callback_id)
            return

        if data == "followup:end_chat":
            self.send_message(
                chat_id,
                "Gracias por escribirnos 💇‍♀️✨\nCuando quieras volver, mandame un \"hola\" y te ayudo con tus turnos.",
                reply_markup={"remove_keyboard": True},
            )
            self.answer_callback_query(callback_id)
            return

        if data.startswith("cancel_select:"):
            turno_id = self._safe_int(data.split(":", 1)[1])
            if not turno_id:
                self.answer_callback_query(callback_id, "Turno invalido")
                return
            self.ask_cancel_confirmation(chat_id, link, turno_id)
            self.answer_callback_query(callback_id)
            return

        if data.startswith("cancel_reason:"):
            parts = data.split(":", 2)
            if len(parts) != 3:
                self.answer_callback_query(callback_id, "Formato invalido")
                return

            turno_id = self._safe_int(parts[1])
            reason_key = parts[2]
            if not turno_id or reason_key not in self.CANCEL_REASON_MAP:
                self.answer_callback_query(callback_id, "Datos invalidos")
                return

            self.ask_cancel_final_confirmation(chat_id, link, turno_id, reason_key)
            self.answer_callback_query(callback_id)
            return

        if data.startswith("cancel_confirm:"):
            parts = data.split(":", 2)
            if len(parts) < 2:
                self.answer_callback_query(callback_id, "Turno invalido")
                return

            turno_id = self._safe_int(parts[1])
            reason_key = parts[2] if len(parts) == 3 else "otro"
            if not turno_id or reason_key not in self.CANCEL_REASON_MAP:
                self.answer_callback_query(callback_id, "Turno invalido")
                return
            self.confirm_cancel(chat_id, link, turno_id, reason_key)
            self.answer_callback_query(callback_id)
            return

        self.answer_callback_query(callback_id)

    def _try_link_by_phone(self, link, raw_phone):
        normalized_input = normalize_phone(raw_phone)
        input_variants = phone_variants(raw_phone)
        if not normalized_input or not input_variants:
            self.send_message(
                link.chat_id,
                "No pude leer ese telefono. Envia solo numeros con codigo de area.",
            )
            return

        match = None
        from apps.users.models import User

        for user in User.objects.select_related("cliente_profile").all():
            user_variants = phone_variants(user.phone)
            if user_variants.intersection(input_variants) and hasattr(user, "cliente_profile"):
                match = user
                break

        if not match:
            self.send_message(
                link.chat_id,
                "No encontre un cliente con ese telefono. Si tenes turno, escribi al local para validar tu cuenta.",
            )
            return

        # Persistimos el chat de Telegram vinculado a la identidad del cliente.
        link.chat_id = int(link.chat_id)
        link.cliente = match.cliente_profile
        link.phone_snapshot = normalized_input
        link.is_verified = True
        link.save(
            update_fields=[
                "chat_id",
                "cliente",
                "phone_snapshot",
                "is_verified",
                "last_seen_at",
            ]
        )

        TelegramConversationState.objects.get_or_create(link=link)

        self.send_message(
            link.chat_id,
            "✅ ¡Cuenta vinculada con exito!\nYa podes gestionar tus turnos desde este chat.",
            reply_markup={"remove_keyboard": True},
        )
        self.send_main_menu(link.chat_id)

    def send_main_menu(self, chat_id):
        text = (
            "✨ BeautyBot | Menu principal\n"
            "Elegi una opcion para continuar:"
        )
        keyboard = {
            "inline_keyboard": [
                [{"text": "📅 Consultar turnos", "callback_data": "menu:list_turnos"}],
                [{"text": "❌ Cancelar turno", "callback_data": "menu:cancel_turno"}],
                [{"text": "💼 Mi estado de cuenta", "callback_data": "menu:status"}],
                [{"text": "🆘 Ayuda", "callback_data": "menu:help"}],
                [{"text": "👋 Finalizar chat", "callback_data": "menu:end_chat"}],
            ]
        }
        self.send_message(chat_id, text, reply_markup=keyboard)

    def send_welcome_message(self, chat_id, link):
        nombre = "Cliente"
        if getattr(link, "cliente", None) and getattr(link.cliente, "user", None):
            first_name = (link.cliente.user.first_name or "").strip()
            if first_name:
                nombre = first_name

        self.send_message(chat_id, f"Hola {nombre} ✨\n¿En que te ayudo hoy?")

    def send_account_status(self, chat_id, link):
        estado = "Vinculada" if link.is_verified else "Pendiente"
        telefono = link.phone_snapshot or "No registrado"
        text = (
            "💼 Estado de tu cuenta\n\n"
            f"• Vinculacion: {estado}\n"
            f"• Telefono: {telefono}\n\n"
            "Si queres actualizar tus datos, hacelo desde tu perfil web y despues volve al menu."
        )
        self.send_message(
            chat_id,
            text,
            reply_markup={
                "inline_keyboard": [[{"text": "⬅️ Volver al menu", "callback_data": "menu:home"}]]
            },
        )

    def send_help(self, chat_id):
        text = (
            "🆘 Centro de ayuda BeautyBot\n\n"
            "• /start o /menu: ver opciones\n"
            "• Consultar: muestra tus proximos turnos\n"
            "• Cancelar: te guia con motivo y confirmacion final\n"
            "• Avanzado: /modificar_turno cancelar <turno_id> [motivo]"
        )
        self.send_message(chat_id, text)
        self.send_main_menu(chat_id)

    def send_post_action_prompt(self, chat_id):
        self.send_message(
            chat_id,
            "¿Puedo ayudarte con algo mas? ✨",
            reply_markup={"remove_keyboard": True},
        )
        self.send_message(
            chat_id,
            "Elegi una opcion:",
            reply_markup={
                "inline_keyboard": [
                    [{"text": "⬅️ Volver al menu", "callback_data": "followup:back"}],
                    [{"text": "👋 Finalizar chat", "callback_data": "followup:end_chat"}],
                ]
            },
        )

    def _send_phone_link_instructions(self, chat_id):
        text = (
            "Para continuar necesito vincular tu cuenta 🔐\n"
            "Toca el boton y comparti tu numero automaticamente."
        )
        reply_keyboard = {
            "keyboard": [
                [
                    {
                        "text": "📱 Compartir mi número",
                        "request_contact": True,
                    }
                ]
            ],
            "resize_keyboard": True,
            "one_time_keyboard": True,
        }
        self.send_message(chat_id, text, reply_markup=reply_keyboard)

    def send_turnos_list(self, chat_id, link):
        if not link.is_verified or not link.cliente:
            self._send_phone_link_instructions(chat_id)
            return

        turnos = (
            Turno.objects.select_related("servicio", "empleado__user")
            .filter(cliente=link.cliente, fecha_hora__gte=timezone.now())
            .exclude(estado__in=["cancelado", "completado", "no_asistio", "expirada"])
            .order_by("fecha_hora")[:8]
        )

        if not turnos:
            self.send_message(chat_id, "📭 No tenes turnos proximos por ahora.")
            self.send_post_action_prompt(chat_id)
            return

        lines = ["📅 Tus proximos turnos:"]
        for turno in turnos:
            fecha = timezone.localtime(turno.fecha_hora).strftime("%d/%m %H:%M")
            profesional = turno.empleado.user.full_name if turno.empleado else "-"
            lines.append(
                f"- #{turno.id} | {fecha} | {turno.servicio.nombre} | {profesional} | Estado: {turno.estado}"
            )

        keyboard = {
            "inline_keyboard": [[{"text": "⬅️ Volver al menu", "callback_data": "menu:home"}]]
        }
        self.send_message(chat_id, "\n".join(lines), reply_markup=keyboard)
        self.send_post_action_prompt(chat_id)

    def send_turnos_for_cancel(self, chat_id, link):
        if not link.is_verified or not link.cliente:
            self._send_phone_link_instructions(chat_id)
            return

        turnos = (
            Turno.objects.select_related("servicio")
            .filter(cliente=link.cliente, fecha_hora__gte=timezone.now())
            .exclude(estado__in=["cancelado", "completado", "no_asistio", "expirada"])
            .order_by("fecha_hora")[:8]
        )

        cancellable = [turno for turno in turnos if turno.puede_cancelar()]
        if not cancellable:
            self.send_message(
                chat_id,
                "⏳ No hay turnos cancelables ahora.\nRecorda: faltando menos de 2 horas no se puede cancelar.",
            )
            self.send_main_menu(chat_id)
            return

        keyboard_rows = []
        for turno in cancellable:
            fecha = timezone.localtime(turno.fecha_hora).strftime("%d/%m %H:%M")
            keyboard_rows.append(
                [
                    {
                        "text": f"#{turno.id} - {fecha} - {turno.servicio.nombre}",
                        "callback_data": f"cancel_select:{turno.id}",
                    }
                ]
            )

        keyboard_rows.append([{"text": "⬅️ Volver al menu", "callback_data": "menu:home"}])
        self.send_message(
            chat_id,
            "Elegi el turno que queres cancelar 👇",
            reply_markup={"inline_keyboard": keyboard_rows},
        )

    def ask_cancel_confirmation(self, chat_id, link, turno_id):
        turno = (
            Turno.objects.select_related("servicio")
            .filter(id=turno_id, cliente=link.cliente)
            .first()
        )
        if not turno:
            self.send_message(chat_id, "No encontre ese turno.")
            self.send_main_menu(chat_id)
            return

        state, _ = TelegramConversationState.objects.get_or_create(link=link)
        state.state = TelegramConversationState.STATE_CONFIRM_CANCEL
        state.pending_turno_id = turno.id
        state.save(update_fields=["state", "pending_turno_id", "updated_at"])

        fecha = timezone.localtime(turno.fecha_hora).strftime("%d/%m/%Y %H:%M")
        text = (
            "🧾 Paso 2/3 - Elegi el motivo de cancelacion:\n"
            f"Turno #{turno.id}\n"
            f"Fecha: {fecha}\n"
            f"Servicio: {turno.servicio.nombre}"
        )
        keyboard = {
            "inline_keyboard": [
                [
                    {
                        "text": "Agenda personal",
                        "callback_data": f"cancel_reason:{turno.id}:agenda",
                    }
                ],
                [
                    {
                        "text": "Motivo de salud",
                        "callback_data": f"cancel_reason:{turno.id}:salud",
                    }
                ],
                [
                    {
                        "text": "Compromiso laboral",
                        "callback_data": f"cancel_reason:{turno.id}:laboral",
                    }
                ],
                [
                    {
                        "text": "Otro motivo",
                        "callback_data": f"cancel_reason:{turno.id}:otro",
                    }
                ],
                [{"text": "⬅️ Volver al menu", "callback_data": "menu:home"}],
            ]
        }
        self.send_message(chat_id, text, reply_markup=keyboard)

    def ask_cancel_final_confirmation(self, chat_id, link, turno_id, reason_key):
        turno = (
            Turno.objects.select_related("servicio")
            .filter(id=turno_id, cliente=link.cliente)
            .first()
        )
        if not turno:
            self.send_message(chat_id, "No encontre ese turno.")
            self.send_main_menu(chat_id)
            return

        motivo = self.CANCEL_REASON_MAP[reason_key]
        fecha = timezone.localtime(turno.fecha_hora).strftime("%d/%m/%Y %H:%M")
        text = (
            "✅ Paso 3/3 - Confirmacion final:\n"
            f"Turno #{turno.id} - {turno.servicio.nombre}\n"
            f"Fecha: {fecha}\n"
            f"Motivo: {motivo}\n"
            "Si confirmas, se aplican las politicas de cancelacion y credito vigentes."
        )
        keyboard = {
            "inline_keyboard": [
                [
                    {
                        "text": "✅ Si, confirmar cancelacion",
                        "callback_data": f"cancel_confirm:{turno.id}:{reason_key}",
                    }
                ],
                [{"text": "⬅️ Volver al menu", "callback_data": "menu:home"}],
            ]
        }
        self.send_message(chat_id, text, reply_markup=keyboard)

    def confirm_cancel(self, chat_id, link, turno_id, reason_key="otro"):
        state, _ = TelegramConversationState.objects.get_or_create(link=link)
        if state.state != TelegramConversationState.STATE_CONFIRM_CANCEL:
            self.send_message(chat_id, "La confirmacion expiro. Volve a intentarlo.")
            self.send_main_menu(chat_id)
            return

        if state.pending_turno_id != turno_id:
            self.send_message(chat_id, "El turno no coincide con la confirmacion activa.")
            self.send_main_menu(chat_id)
            return

        turno = (
            Turno.objects.select_related("servicio", "cliente__user")
            .filter(id=turno_id, cliente=link.cliente)
            .first()
        )
        if not turno:
            self.send_message(chat_id, "No encontre ese turno.")
            self.send_main_menu(chat_id)
            return

        try:
            motivo = self.CANCEL_REASON_MAP.get(
                reason_key, "Cancelacion solicitada desde Telegram"
            )
            result = cancelar_turno_para_cliente(
                turno=turno,
                usuario=link.cliente.user,
                motivo=motivo,
            )
        except ValueError as exc:
            self.send_message(chat_id, f"No pude cancelar el turno: {exc}")
            self.send_main_menu(chat_id)
            return

        state.state = TelegramConversationState.STATE_IDLE
        state.pending_turno_id = None
        state.save(update_fields=["state", "pending_turno_id", "updated_at"])

        credit_line = (
            f"Se acredito ${result.monto_credito:.2f} en tu billetera."
            if result.credito_aplicado
            else (
                "No se genero credito porque no se cumplio la anticipacion minima "
                f"de {result.horas_antelacion_requerida} horas."
            )
        )
        nombre = "Cliente"
        if getattr(link, "cliente", None) and getattr(link.cliente, "user", None):
            nombre = (
                (link.cliente.user.first_name or "").strip() or "Cliente"
            )

        monto_senia = float(turno.senia_pagada or 0)
        monto_bono = float(getattr(turno, "descuento_aplicado", 0) or 0)
        self.send_message(
            chat_id,
            (
                "❌ Turno cancelado con exito\n\n"
                f"Hola {nombre}, el turno #{turno.id} ha sido dado de baja del sistema.\n\n"
                "💰 Movimiento de Fondos:\n"
                f"• Sena recuperada: ${monto_senia:,.2f}\n"
                f"• Bono de Regalo: ${monto_bono:,.2f}\n"
                f"• Destino: Tu Billetera Virtual 📲\n\n"
                f"{credit_line}\n"
                "Podes usar este saldo para tu proxima reserva desde la web. ¡Te esperamos pronto!"
            ),
        )
        self.send_post_action_prompt(chat_id)

    def clear_inline_keyboard(self, chat_id, message_id):
        if not self.token:
            return None

        url = f"{self.API_BASE}/bot{self.token}/editMessageReplyMarkup"
        payload = {
            "chat_id": chat_id,
            "message_id": message_id,
            "reply_markup": {"inline_keyboard": []},
        }
        return self._post(url, payload)

    def send_message(self, chat_id, text, reply_markup=None):
        if not self.token:
            logger.warning("Telegram token no configurado. Mensaje omitido.")
            return None

        url = f"{self.API_BASE}/bot{self.token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup

        return self._post(url, payload)

    def answer_callback_query(self, callback_query_id, text=None):
        if not self.token or not callback_query_id:
            return None

        url = f"{self.API_BASE}/bot{self.token}/answerCallbackQuery"
        payload = {"callback_query_id": callback_query_id}
        if text:
            payload["text"] = text
        return self._post(url, payload)

    def _post(self, url, payload):
        try:
            return requests.post(url, json=payload, timeout=self.timeout)
        except requests.RequestException as exc:
            logger.exception("Error enviando mensaje a Telegram: %s", exc)
            return None

    @staticmethod
    def _safe_int(value):
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _simplify_text(value):
        text = (value or "").strip().lower()
        text = "".join(
            c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
        )
        return text

    def _is_greeting(self, text):
        simplified = self._simplify_text(text)
        return any(
            simplified == k or simplified.startswith(f"{k} ")
            for k in self.GREETING_KEYWORDS
        )

    def _is_farewell(self, text):
        simplified = self._simplify_text(text)
        return any(
            simplified == k or simplified.startswith(f"{k} ")
            for k in self.FAREWELL_KEYWORDS
        )


def normalize_phone(value):
    if not value:
        return ""
    digits = re.sub(r"\D", "", str(value))
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("0") and len(digits) > 10:
        digits = digits[1:]
    if digits.startswith("549"):
        return digits
    if digits.startswith("54"):
        return f"549{digits[2:]}"
    if len(digits) == 10:
        return f"549{digits}"
    return digits


def phone_variants(value):
    """Genera variantes de telefono para empatar formato local e internacional."""
    if not value:
        return set()

    digits = re.sub(r"\D", "", str(value))
    if not digits:
        return set()

    if digits.startswith("00"):
        digits = digits[2:]

    variants = {digits}

    # Formato internacional AR (54 / 549)
    if digits.startswith("549"):
        variants.add(digits[2:])  # 9 + area + numero
        variants.add(digits[3:])  # area + numero
    if digits.startswith("54"):
        variants.add(digits[2:])

    # Prefijo local con 0 troncal
    if digits.startswith("0"):
        variants.add(digits[1:])

    # Si tiene prefijo 9 de celular internacional, quitarlo
    for candidate in list(variants):
        if candidate.startswith("9") and len(candidate) >= 10:
            variants.add(candidate[1:])

    # Si llega sin prefijo pais y tiene 10 digitos (area + numero), agregar variantes AR.
    for candidate in list(variants):
        if len(candidate) == 10 and candidate.isdigit():
            variants.add(f"54{candidate}")
            variants.add(f"549{candidate}")
            variants.add(f"0{candidate}")

    return {v for v in variants if v}
