from apps.users.models import CustomUser
from rest_framework.authtoken.models import Token

# Buscar propietario
propietarios = CustomUser.objects.filter(role='propietario')
print(f'Total propietarios: {propietarios.count()}')

for prop in propietarios:
    print(f'\nUsuario: {prop.email}')
    print(f'Username: {prop.username}')
    print(f'Activo: {prop.is_active}')
    
    # Obtener o crear token
    token, created = Token.objects.get_or_create(user=prop)
    print(f'Token: {token.key}')
    print(f'Token creado ahora: {created}')
