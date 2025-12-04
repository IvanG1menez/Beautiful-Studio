from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

User = get_user_model()

# Buscar TODOS los propietarios
propietarios = User.objects.filter(role='propietario')

print(f'\n=== Total de propietarios: {propietarios.count()} ===\n')

if not propietarios.exists():
    print('❌ No hay usuarios con rol "propietario"')
else:
    for prop in propietarios:
        print(f'Email: {prop.email}')
        print(f'Username: {prop.username}')
        print(f'Rol: {prop.role}')
        print(f'Activo: {prop.is_active}')
        
        # Verificar si tiene token
        try:
            token = Token.objects.get(user=prop)
            print(f'✅ Token existente: {token.key}')
        except Token.DoesNotExist:
            # Crear token si no existe
            token = Token.objects.create(user=prop)
            print(f'🆕 Token creado: {token.key}')
        
        print('-' * 60)
