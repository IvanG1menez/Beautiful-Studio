import os
import sys
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.turnos.models import Turno
from django.utils import timezone

turnos = Turno.objects.filter(
    empleado__user__email='adrianacruz@gmail.com'
).order_by('-fecha_hora')[:10]

print('\nÚltimos 10 turnos de Adriana Cruz:')
print('=' * 80)
for t in turnos:
    print(f'  ID: {t.id}')
    print(f'  Estado: {t.estado}')
    print(f'  Fecha: {t.fecha_hora}')
    print(f'  Cliente: {t.cliente.nombre_completo} ({t.cliente.user.email})')
    print(f'  Servicio: {t.servicio.nombre}')
    print(f'  Precio: ${t.precio_final}')
    print('-' * 80)
