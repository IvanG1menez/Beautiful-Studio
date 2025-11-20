import os, sys, django

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.turnos.models import Turno

print("\n" + "="*60)
print("CANCELANDO ÚLTIMO TURNO PARA PROBAR EMAILS")
print("="*60)

turno = Turno.objects.latest('id')

print(f"\n📋 Turno ID: {turno.id}")
print(f"📋 Profesional: {turno.empleado.user.get_full_name()}")
print(f"📋 Cliente: {turno.cliente.nombre_completo}")
print(f"📋 Servicio: {turno.servicio.nombre}")
print(f"📋 Estado actual: {turno.get_estado_display()}")

print(f"\n🔄 Cancelando turno...")
turno.estado = 'cancelado'
turno.save()

print(f"✅ Turno cancelado exitosamente!")

print("\n" + "="*60)
print("📧 VERIFICA TU INBOX EN MAILTRAP")
print("="*60)
print("\nDeberías recibir 2 emails más en gimenezivanb@gmail.com:")
print("  3. Email al profesional (turno cancelado)")
print("  4. Email al propietario (turno cancelado)")
print("\n✨ Total: 4 emails en Mailtrap")
print()
