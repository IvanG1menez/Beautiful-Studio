from django.apps import AppConfig


class TurnosConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.turnos'
    
    def ready(self):
        """Importar signals cuando la app esté lista"""
        import apps.turnos.signals
