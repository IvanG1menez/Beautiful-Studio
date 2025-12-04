from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

User = get_user_model()

# Buscar propietario
propietarios = User.objects.filter(role='propietario')
print(f'Total propietarios: {propietarios.count()}')

for prop in propietarios:
    print(f'\nUsuario: {prop.email}')
    print(f'Username: {prop.username}')
    print(f'Activo: {prop.is_active}')
    
    # Obtener o crear token
    token, created = Token.objects.get_or_create(user=prop)
    print(f'Token: {token.key}')
    print(f'Token creado ahora: {created}')
