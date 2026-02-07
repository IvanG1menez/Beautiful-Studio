import os
import django
from django.db.utils import ProgrammingError, OperationalError

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.users.models import User
from apps.clientes.models import Cliente
from apps.servicios.models import Servicio, CategoriaServicio
from apps.turnos.models import Turno


def cleanup_total():
    print("🧹 Iniciando limpieza profunda de datos de prueba...")

    # 1. Borrar turnos vinculados a servicios de prueba
    Turno.objects.filter(servicio__nombre__icontains="TEST").delete()
    print("✅ Turnos de prueba eliminados.")

    # 2. Borrar perfiles de Cliente de prueba
    Cliente.objects.filter(user__username__icontains="test").delete()
    print("✅ Perfiles de Cliente eliminados.")

    # 3. Borrar usuarios de prueba con manejo de errores
    users_test = User.objects.filter(username__icontains="test")
    for user in users_test:
        try:
            user.delete()
        except (ProgrammingError, OperationalError) as e:
            print(
                f"⚠️  Error al borrar usuario {user.username}: {e}. "
                "Se intenta borrado directo para continuar."
            )
            try:
                User.objects.filter(id=user.id)._raw_delete(User.objects.db)
            except Exception as raw_error:
                print(
                    f"⚠️  No se pudo borrar usuario {user.username} por SQL directo: {raw_error}. "
                    "Continuando con el siguiente."
                )
        except Exception as e:
            print(
                f"⚠️  Error inesperado al borrar usuario {user.username}: {e}. "
                "Continuando con el siguiente."
            )
    print("✅ Usuarios de prueba eliminados (con bypass de tablas inexistentes).")

    # 4. Borrar servicios y categorías de prueba
    Servicio.objects.filter(nombre__icontains="TEST").delete()
    CategoriaServicio.objects.filter(nombre="Estética").delete()
    print("✅ Servicios y Categorías de prueba eliminados.")

    print("\n✨ Base de datos limpia. Ya puedes correr el seed_test.py")


if __name__ == "__main__":
    cleanup_total()
