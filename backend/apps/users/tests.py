from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from apps.clientes.models import Cliente
from apps.telegram_bot.models import TelegramLink

from .models import User


class UserPhoneAndTelegramTests(APITestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			email="cliente1@test.com",
			password="password1.2.3",
			username="cliente1",
			first_name="Cliente",
			last_name="Uno",
			role="cliente",
		)
		self.cliente = Cliente.objects.create(user=self.user)
		token = Token.objects.create(user=self.user)
		self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

	def test_update_phone_endpoint_updates_phone(self):
		url = reverse("users:update-phone")
		response = self.client.patch(url, {"phone": "+54 9 11 1111-1111"}, format="json")

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.user.refresh_from_db()
		self.assertEqual(self.user.phone, "+54 9 11 1111-1111")

	def test_update_phone_rejects_duplicate_phone(self):
		User.objects.create_user(
			email="cliente2@test.com",
			password="password1.2.3",
			username="cliente2",
			first_name="Cliente",
			last_name="Dos",
			role="cliente",
			phone="+54 9 11 2222-2222",
		)

		url = reverse("users:update-phone")
		response = self.client.patch(url, {"phone": "+54 9 11 2222-2222"}, format="json")

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn("phone", response.data)

	def test_profile_includes_telegram_fields(self):
		TelegramLink.objects.create(
			telegram_user_id=123456,
			chat_id=987654,
			cliente=self.cliente,
			is_verified=True,
		)

		url = reverse("users:me")
		response = self.client.get(url)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data.get("telegram_chat_id"), 987654)
		self.assertTrue(response.data.get("has_telegram_link"))
