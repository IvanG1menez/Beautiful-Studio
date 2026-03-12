import os
import sys
import django

# Agregar el directorio backend al path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.turnos.models import LogReasignacion

log = LogReasignacion.objects.select_related(
    "turno_ofrecido__cliente__user", "turno_cancelado"
).get(id=4)

print()
print("=" * 70)
print("✅ OFERTA ENVIADA EXITOSAMENTE")
print("=" * 70)
print()
print(f"📧 Cliente notificado: {log.turno_ofrecido.cliente.nombre_completo}")
print(f"   Email: {log.turno_ofrecido.cliente.user.email}")
print()
print(f"🎫 Turno original:")
print(f"   Fecha actual: {log.turno_ofrecido.fecha_hora.strftime('%d/%m/%Y %H:%M')}")
print()
print(f"🎫 Turno adelantado (cancelado):")
print(f"   Nueva fecha: {log.turno_cancelado.fecha_hora.strftime('%d/%m/%Y %H:%M')}")
print()
print(f"⏰ Expira: {log.expires_at.strftime('%d/%m/%Y %H:%M')}")
print(f"🔑 Token: {log.token}")
print()
print("=" * 70)
print("🔗 LINK DE CONFIRMACIÓN")
print("=" * 70)
print()
print(f"http://localhost:3000/reacomodamiento/confirmar?token={log.token}")
print()
print("=" * 70)
print()
