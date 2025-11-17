import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.turnos.models import Turno
from apps.users.models import User

# Verificar turno 72
try:
    turno = Turno.objects.get(id=72)
    print(f"✅ Turno 72 existe")
    print(f"  - Cliente: {turno.cliente}")
    print(
        f"  - Empleado: {turno.empleado.user.get_full_name()} (ID: {turno.empleado.id})"
    )
    print(f"  - Estado: {turno.estado}")
    print(f"  - Fecha: {turno.fecha_hora}")
except Turno.DoesNotExist:
    print("❌ Turno 72 NO existe")

# Verificar usuario autenticado
user = User.objects.get(email="pro.adriana.cruz.pro636292@gmail.com")
print(f"\n✅ Usuario: {user.get_full_name()} (ID: {user.id})")
print(f"  - Tiene profesional_profile: {hasattr(user, 'profesional_profile')}")
if hasattr(user, "profesional_profile"):
    print(f"  - profesional_profile.id: {user.profesional_profile.id}")

# Simular get_queryset del ViewSet
from apps.turnos.views import TurnoViewSet
from django.test import RequestFactory
from rest_framework.request import Request

factory = RequestFactory()
request = factory.patch("/api/turnos/72/")
request.user = user

# Crear una instancia del viewset
viewset = TurnoViewSet()
viewset.request = Request(request)
viewset.action = "partial_update"  # Esta es la acción de PATCH
viewset.kwargs = {"pk": 72}

# Obtener el queryset
queryset = viewset.get_queryset()
print(f"\n📊 Queryset para partial_update:")
print(f"  - Total turnos en queryset: {queryset.count()}")
print(f"  - Turno 72 en queryset: {queryset.filter(id=72).exists()}")

if queryset.filter(id=72).exists():
    t = queryset.get(id=72)
    print(f"  - ✅ Turno 72 encontrado en queryset")
else:
    print(f"  - ❌ Turno 72 NO está en queryset")
    print(f"\n🔍 Analizando por qué no está:")
    print(
        f"  - Queryset filtrado por empleado: {queryset.filter(empleado__user=user).count()} turnos"
    )
    print(f"  - Turno 72 empleado_id: {turno.empleado.id}")
    print(f"  - Usuario profesional_profile.id: {user.profesional_profile.id}")
    print(f"  - ¿Coinciden? {turno.empleado.id == user.profesional_profile.id}")
