"""
Configuración de Celery para Beautiful Studio
"""
import os
from celery import Celery
from celery.schedules import crontab

# Configurar Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('beautiful_studio')

# Cargar configuración desde Django settings con prefijo CELERY_
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-descubrir tasks en todas las apps instaladas
app.autodiscover_tasks()

# Configuración de tareas periódicas (Celery Beat)
app.conf.beat_schedule = {
    # Enviar recordatorios de turnos 24 horas antes
    'enviar-recordatorios-diarios': {
        'task': 'apps.notificaciones.tasks.enviar_recordatorios_turnos',
        'schedule': crontab(hour=9, minute=0),  # Todos los días a las 9:00 AM
    },
    # Enviar reporte diario a propietarios
    'enviar-reporte-diario': {
        'task': 'apps.notificaciones.tasks.enviar_reporte_diario_propietarios',
        'schedule': crontab(hour=20, minute=0),  # Todos los días a las 8:00 PM
    },
}

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Tarea de debug para verificar que Celery funcione"""
    print(f'Request: {self.request!r}')
