from unittest.mock import patch

from django.conf import settings
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.clientes.models import Cliente
from apps.users.models import User

from .models import TelegramLink, TelegramUpdateLog
from .services import TelegramBotService, normalize_phone, phone_variants


class TelegramWebhookTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = "/api/telegram/webhook/"

    @override_settings(TELEGRAM_WEBHOOK_SECRET="my-secret")
    def test_rejects_invalid_secret(self):
        response = self.client.post(
            self.url,
            data={"update_id": 1001, "message": {"text": "/start"}},
            format="json",
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="bad-secret",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(TelegramUpdateLog.objects.count(), 0)

    @override_settings(TELEGRAM_WEBHOOK_SECRET="my-secret")
    @patch("apps.telegram_bot.views.process_telegram_update.delay")
    def test_deduplicates_update_id(self, mocked_delay):
        headers = {"HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN": "my-secret"}

        first = self.client.post(
            self.url,
            data={"update_id": 2002, "message": {"text": "/start"}},
            format="json",
            **headers,
        )
        second = self.client.post(
            self.url,
            data={"update_id": 2002, "message": {"text": "/start"}},
            format="json",
            **headers,
        )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(TelegramUpdateLog.objects.count(), 1)
        mocked_delay.assert_called_once()


class NormalizePhoneTests(TestCase):
    def test_normalizes_argentina_phone_numbers(self):
        self.assertEqual(normalize_phone("+54 9 11 2233-4455"), "5491122334455")
        self.assertEqual(normalize_phone("011 2233 4455"), "5491122334455")
        self.assertEqual(normalize_phone("5491122334455"), "5491122334455")
        self.assertEqual(normalize_phone(""), "")

    def test_phone_variants_include_local_and_international_forms(self):
        variants = phone_variants("+54 9 11 2233-4455")
        self.assertIn("5491122334455", variants)
        self.assertIn("1122334455", variants)
        self.assertIn("01122334455", variants)


class TelegramContactFlowTests(TestCase):
    def test_phone_instructions_send_contact_keyboard(self):
        service = TelegramBotService()

        with patch.object(service, "send_message") as mocked_send_message:
            service._send_phone_link_instructions(chat_id=999)

        mocked_send_message.assert_called_once()
        args, kwargs = mocked_send_message.call_args
        self.assertEqual(args[0], 999)
        self.assertIn("reply_markup", kwargs)
        keyboard = kwargs["reply_markup"]
        self.assertTrue(keyboard.get("resize_keyboard"))
        button = keyboard["keyboard"][0][0]
        self.assertEqual(button["text"], "📱 Compartir mi número")
        self.assertTrue(button["request_contact"])

    def test_link_success_message_and_chat_id_persisted(self):
        user = User.objects.create_user(
            email="cliente.telegram@test.com",
            password="password1.2.3",
            first_name="Cliente",
            last_name="Telegram",
            phone="+54 9 11 2233-4455",
        )
        cliente = Cliente.objects.create(user=user)
        link = TelegramLink.objects.create(telegram_user_id=12345, chat_id=67890)

        service = TelegramBotService()
        with patch.object(service, "send_message") as mocked_send_message, patch.object(
            service, "send_main_menu"
        ) as mocked_main_menu:
            service._try_link_by_phone(link, "+54 9 11 2233-4455")

        link.refresh_from_db()
        self.assertEqual(link.cliente_id, cliente.id)
        self.assertTrue(link.is_verified)
        self.assertEqual(link.chat_id, 67890)

        mocked_send_message.assert_called_once_with(
            67890,
            "✅ ¡Cuenta vinculada con exito!\nYa podes gestionar tus turnos desde este chat.",
            reply_markup={"remove_keyboard": True},
        )
        mocked_main_menu.assert_called_once_with(67890)

    def test_links_user_when_db_phone_is_local_and_telegram_is_international(self):
        user = User.objects.create_user(
            email="cliente.local@test.com",
            password="password1.2.3",
            first_name="Cliente",
            last_name="Local",
            username="cliente_local",
            phone="011 2233 4455",
        )
        cliente = Cliente.objects.create(user=user)
        link = TelegramLink.objects.create(telegram_user_id=54321, chat_id=98765)

        service = TelegramBotService()
        with patch.object(service, "send_message"), patch.object(service, "send_main_menu"):
            service._try_link_by_phone(link, "+54 9 11 2233-4455")

        link.refresh_from_db()
        self.assertEqual(link.cliente_id, cliente.id)
        self.assertTrue(link.is_verified)


class TelegramFlowRoutingTests(TestCase):
    def test_callback_cancel_reason_routes_to_final_confirmation(self):
        link = TelegramLink.objects.create(
            telegram_user_id=2222,
            chat_id=7777,
            is_verified=True,
        )
        service = TelegramBotService()

        with patch.object(
            service, "clear_inline_keyboard"
        ) as mocked_clear, patch.object(
            service, "ask_cancel_final_confirmation"
        ) as mocked_ask_final, patch.object(
            service, "answer_callback_query"
        ) as mocked_answer:
            service._handle_callback_query(
                {
                    "id": "cb-1",
                    "data": "cancel_reason:15:agenda",
                    "from": {"id": link.telegram_user_id},
                    "message": {"chat": {"id": link.chat_id}, "message_id": 101},
                }
            )

        mocked_clear.assert_called_once_with(7777, 101)
        mocked_ask_final.assert_called_once_with(7777, link, 15, "agenda")
        mocked_answer.assert_called_once_with("cb-1")

    def test_callback_cancel_confirm_with_reason_calls_confirm_cancel(self):
        link = TelegramLink.objects.create(
            telegram_user_id=3333,
            chat_id=8888,
            is_verified=True,
        )
        service = TelegramBotService()

        with patch.object(service, "clear_inline_keyboard") as mocked_clear, patch.object(service, "confirm_cancel") as mocked_confirm, patch.object(
            service, "answer_callback_query"
        ) as mocked_answer:
            service._handle_callback_query(
                {
                    "id": "cb-2",
                    "data": "cancel_confirm:45:salud",
                    "from": {"id": link.telegram_user_id},
                    "message": {"chat": {"id": link.chat_id}, "message_id": 202},
                }
            )

        mocked_clear.assert_called_once_with(8888, 202)
        mocked_confirm.assert_called_once_with(8888, link, 45, "salud")
        mocked_answer.assert_called_once_with("cb-2")


class TelegramWelcomeMessageTests(TestCase):
    def test_send_welcome_message_uses_client_name_when_available(self):
        user = User.objects.create_user(
            email="welcome@test.com",
            password="password1.2.3",
            first_name="Lucia",
            last_name="Perez",
            username="lucia",
        )
        cliente = Cliente.objects.create(user=user)
        link = TelegramLink.objects.create(
            telegram_user_id=4444,
            chat_id=9999,
            cliente=cliente,
            is_verified=True,
        )

        service = TelegramBotService()
        with patch.object(service, "send_message") as mocked_send_message:
            service.send_welcome_message(9999, link)

        mocked_send_message.assert_called_once_with(
            9999,
            "Hola Lucia ✨\n¿En que te ayudo hoy?",
        )


class TelegramGreetingAndFarewellTests(TestCase):
    def test_greeting_text_shows_reactivation_message_and_main_menu(self):
        user = User.objects.create_user(
            email="reactivacion@test.com",
            password="password1.2.3",
            username="reactivacion",
            first_name="Juan",
            last_name="Cliente",
            phone="+54 9 11 3333-2222",
        )
        cliente = Cliente.objects.create(user=user)
        TelegramLink.objects.create(
            telegram_user_id=777001,
            chat_id=555001,
            cliente=cliente,
            is_verified=True,
        )

        service = TelegramBotService()
        with patch.object(service, "send_message") as mocked_send, patch.object(
            service, "send_main_menu"
        ) as mocked_menu:
            service._handle_message(
                {
                    "chat": {"id": 555001},
                    "from": {"id": 777001},
                    "text": "Hola",
                }
            )

        mocked_send.assert_called_once_with(
            555001,
            "¡Hola de nuevo! ✨\nQue lindo tenerte por aca. ¿Que queres hacer hoy?",
        )
        mocked_menu.assert_called_once_with(555001)

    def test_farewell_text_thanks_and_removes_keyboard(self):
        user = User.objects.create_user(
            email="despedida@test.com",
            password="password1.2.3",
            username="despedida",
            first_name="Ana",
            last_name="Cliente",
            phone="+54 9 11 8888-1111",
        )
        cliente = Cliente.objects.create(user=user)
        TelegramLink.objects.create(
            telegram_user_id=777002,
            chat_id=555002,
            cliente=cliente,
            is_verified=True,
        )

        service = TelegramBotService()
        with patch.object(service, "send_message") as mocked_send:
            service._handle_message(
                {
                    "chat": {"id": 555002},
                    "from": {"id": 777002},
                    "text": "gracias",
                }
            )

        mocked_send.assert_called_once_with(
            555002,
            "Gracias por escribirnos 💇‍♀️✨\nCuando quieras volver, mandame un \"hola\" o /start y seguimos.",
            reply_markup={"remove_keyboard": True},
        )
