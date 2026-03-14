#test de creacion de clientes
from django.contrib.auth import get_user_model
from django.test import TestCase

User = get_user_model()

# Create your tests here.
class ClienteTestCase(TestCase):
    def setUp(self):
        User.objects.create_user(
            email="test@example.com",
            password="testpassword"
        )
