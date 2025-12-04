"""
Management command para mostrar información del propietario
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = 'Muestra información del usuario propietario'

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
            self.stdout.write(f'Nombre: {prop.first_name} {prop.last_name}')
            self.stdout.write(f'Activo: {prop.is_active}')
            self.stdout.write(f'\nPara cambiar la contraseña, ejecuta:')
            self.stdout.write(f'python manage.py changepassword {prop.username}')
