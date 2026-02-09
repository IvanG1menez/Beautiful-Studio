from apps.turnos.models import Turno
import time

# 1. Buscamos un turno y guardamos su estado original
turno = Turno.objects.filter(cliente__user__username="cliente_test_0").first()
print(f"🕒 Estado Original: Precio ${turno.precio} - Estado: {turno.estado}")

# 2. Simulamos un cambio (como si fuera el Proceso 2)
turno.precio = 12000.00
turno.estado = "confirmado"
turno.save()
print("⚡ Cambio aplicado (Simulando Proceso 2)...")

# 3. Consultamos el historial
print(f"📜 Cantidad de versiones en el historial: {turno.history.count()}")
ultima_version = turno.history.first()
print(f"👤 Usuario que cambió: {ultima_version.history_user}")
print(f"📉 Precio en la versión anterior: {turno.history.all()[1].precio}")

# 4. PRUEBA DE FUEGO: Volver al estado anterior
version_anterior = turno.history.all()[1]
version_anterior.instance.save()  # Esto restaura el objeto a como estaba antes
print(f"🔙 Reversión exitosa. Precio actual: ${Turno.objects.get(id=turno.id).precio}")
