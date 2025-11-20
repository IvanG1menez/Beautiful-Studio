import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.turnos.models import Turno
from apps.clientes.models import Cliente
from apps.empleados.models import Empleado
from apps.servicios.models import Servicio
from django.utils import timezone
from datetime import timedelta

# Obtener Adriana Cruz
adriana = Empleado.objects.get(id=71)

# Obtener Ricardo Prieto
ricardo = Cliente.objects.get(user__email='ricardo.prieto98@hotmail.com')

# Obtener un servicio (Alisado Brasileño)
servicio = Servicio.objects.filter(nombre__icontains='Alisado').first()

# Crear turno confirmado para HOY (hace 2 horas)
fecha_turno = timezone.now() - timedelta(hours=2)

turno = Turno.objects.create(
    cliente=ricardo,
    empleado=adriana,
    servicio=servicio,
    fecha_hora=fecha_turno,
    estado='confirmado',
    precio_final=servicio.precio
)

print(f'✅ Turno creado exitosamente!')
print(f'   ID: {turno.id}')
print(f'   Cliente: {ricardo.nombre_completo} ({ricardo.user.email})')
print(f'   Profesional: {adriana.nombre_completo}')
print(f'   Servicio: {servicio.nombre}')
print(f'   Fecha: {fecha_turno}')
print(f'   Estado: {turno.estado}')
print(f'   Precio: ${turno.precio_final}')
print(f'\nAhora puedes completar este turno desde el dashboard del profesional')
