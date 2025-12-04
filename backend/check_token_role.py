from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

User = get_user_model()

token_key = '102f648c465f8a73f678c0941adf0e027debe2e3'

try:
    token = Token.objects.get(key=token_key)
    user = token.user
    print(f'Usuario: {user.email}')
    print(f'Username: {user.username}')
    print(f'Rol: {user.role}')
    print(f'Es propietario: {user.role == "propietario"}')
    print(f'Activo: {user.is_active}')
except Token.DoesNotExist:
    print(f'Token no encontrado')
