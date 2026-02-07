# Este script es para cargar datos de prueba en tu base de datos, específicamente para probar el Proceso 2 (envío de mail a cliente con turno a 30 días).
import os
import django
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone

# Asegúrate de que 'core' sea el nombre de la carpeta donde está tu settings.py
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.users.models import User
from apps.clientes.models import Cliente
from apps.servicios.models import Servicio, CategoriaServicio
from apps.empleados.models import Empleado
from apps.turnos.models import Turno


def seed():
    print("🚀 Iniciando carga de datos reales para prueba de Proceso 2...")
    ahora = timezone.now()

    # Limpieza preventiva del usuario de prueba del profesional
    try:
        User.objects.filter(username="pro_estudio_test").delete()
    except Exception as e:
        print(
            f"⚠️  No se pudo borrar pro_estudio_test antes del seed: {e}. "
            "Continuando con la carga."
        )

    # 1. Categoría y Servicio (Usamos get_or_create para no duplicar)
    cat, _ = CategoriaServicio.objects.get_or_create(nombre="Estética")
    srv, created = Servicio.objects.get_or_create(
        nombre="Limpieza Facial Profunda TEST",
        defaults={
            "precio": Decimal("15000.00"),
            "duracion_minutos": 60,
            "categoria": cat,
            "permite_reacomodamiento": True,
            "valor_descuento_adelanto": Decimal("20.00"),
            "tipo_descuento_adelanto": "PORCENTAJE",
            "tiempo_espera_respuesta": 15,
        },
    )
    if not created:
        srv.precio = Decimal("15000.00")
        srv.duracion_minutos = 60
        srv.categoria = cat
        srv.permite_reacomodamiento = True
        srv.valor_descuento_adelanto = Decimal("20.00")
        srv.tipo_descuento_adelanto = "PORCENTAJE"
        srv.tiempo_espera_respuesta = 15
        srv.save()

    # 2. Empleado de prueba
    u_emp, created = User.objects.get_or_create(
        username="pro_estudio_test",
        defaults={
            "email": "pro_estudio_test@ejemplo.com",
            "first_name": "Admin",
            "last_name": "Pruebas",
            "role": "profesional",
            "is_active": True,
        },
    )
    if not created:
        if not u_emp.first_name:
            u_emp.first_name = "Admin"
        if not u_emp.last_name:
            u_emp.last_name = "Pruebas"
        if not u_emp.role:
            u_emp.role = "profesional"
        u_emp.save()
    emp, _ = Empleado.objects.get_or_create(
        user=u_emp,
        defaults={
            "fecha_ingreso": ahora.date(),
            "horario_entrada": "09:00",
            "horario_salida": "18:00",
            "dias_trabajo": "L,M,M,J,V",
            "is_disponible": True,
        },
    )

    # 3. Clientes de prueba (puedes poner tu mail real aquí si quieres)
    emails = ["tu_email@ejemplo.com", "test2@ejemplo.com", "test3@ejemplo.com"]
    clientes = []
    for i, email in enumerate(emails):
        u, created = User.objects.get_or_create(
            username=f"cliente_test_{i}",
            defaults={
                "email": email,
                "first_name": f"ClienteTest_{i}",
                "last_name": "Seed",
                "role": "cliente",
                "is_active": True,
            },
        )
        if not created:
            if not u.email:
                u.email = email
            if not u.first_name:
                u.first_name = f"ClienteTest_{i}"
            if not u.last_name:
                u.last_name = "Seed"
            if not u.role:
                u.role = "cliente"
            u.save()
        c, _ = Cliente.objects.get_or_create(user=u)
        clientes.append(c)

    # 4. Turnos escalonados
    # Turno 1: MAÑANA (El que vas a CANCELAR manualmente en el navegador)
    t_cancelar = Turno.objects.create(
        cliente=clientes[0],
        servicio=srv,
        empleado=emp,
        fecha_hora=ahora + timedelta(days=1),
        estado="pendiente",
    )

    # Turno 2: SEMANA QUE VIENE (Intermedio)
    Turno.objects.create(
        cliente=clientes[1],
        servicio=srv,
        empleado=emp,
        fecha_hora=ahora + timedelta(days=7),
        estado="pendiente",
    )

    # Turno 3: EL CANDIDATO (A 30 días - El que debería recibir el mail)
    Turno.objects.create(
        cliente=clientes[2],
        servicio=srv,
        empleado=emp,
        fecha_hora=ahora + timedelta(days=30),
        estado="pendiente",
    )

    print(f"\n✅ Escenario listo.")
    print(f"👉 Turno para cancelar (ClienteTest_0): ID {t_cancelar.id}")
    print(
        f"👉 Candidato que debería recibir mail: ClienteTest_2 (30 días de distancia)"
    )


if __name__ == "__main__":
    seed()
