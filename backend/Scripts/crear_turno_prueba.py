import os, sys, django

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.turnos.models import Turno
from apps.clientes.models import Cliente
from apps.empleados.models import Empleado
from apps.servicios.models import Servicio
from django.utils import timezone
from datetime import timedelta

print("\n" + "="*60)
print("CREANDO TURNO DE PRUEBA PARA EMAILS")
print("="*60)

emp = Empleado.objects.first()
cli = Cliente.objects.first()
serv = Servicio.objects.first()

print(f"\n📋 Profesional: {emp.user.get_full_name()} ({emp.user.email})")
print(f"📋 Cliente: {cli.nombre_completo}")
print(f"📋 Servicio: {serv.nombre}")

turno = Turno.objects.create(
    cliente=cli,
    empleado=emp,
    servicio=serv,
    fecha_hora=timezone.now() + timedelta(days=3),
    estado='pendiente',
    notas_cliente='Turno de prueba para verificar emails en Mailtrap'
)

print(f"\n✅ Turno creado exitosamente!")
print(f"   ID: {turno.id}")
print(f"   Fecha: {turno.fecha_hora.strftime('%d/%m/%Y %H:%M')}")

print("\n" + "="*60)
print("📧 VERIFICA TU INBOX EN MAILTRAP")
print("="*60)
print("\nDeberías recibir 2 emails en gimenezivanb@gmail.com:")
print("  1. Email al profesional (nuevo turno asignado)")
print("  2. Email al propietario (nuevo turno en el sistema)")
print("\n✨ Revisa https://mailtrap.io")
print()
