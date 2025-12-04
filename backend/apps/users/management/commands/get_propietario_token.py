"""
Management command para obtener el token del propietario
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token


class Command(BaseCommand):
    help = 'Obtiene o crea el token del usuario propietario'

    def handle(self, *args, **options):
        User = get_user_model()
        
        # Buscar propietario
        propietarios = User.objects.filter(role='propietario')
        
        if not propietarios.exists():
            self.stdout.write(self.style.ERROR('No se encontró ningún usuario con rol propietario'))
            return
        
        for prop in propietarios:
            self.stdout.write(f'\n=== Usuario Propietario ===')
            self.stdout.write(f'Email: {prop.email}')
            self.stdout.write(f'Username: {prop.username}')
            self.stdout.write(f'Activo: {prop.is_active}')
            
            # Obtener o crear token
            token, created = Token.objects.get_or_create(user=prop)
            self.stdout.write(f'Token: {token.key}')
            self.stdout.write(f'Creado ahora: {"Sí" if created else "No"}')
            
            self.stdout.write('\nGuarda este token en el localStorage como "auth_token"')
