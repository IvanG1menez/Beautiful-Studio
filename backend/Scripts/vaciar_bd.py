import os
import sys
import django

# Agregar el directorio backend al path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.db import connection
from django.apps import apps
from apps.users.models import User

# Emails de usuarios base que no se deben borrar
USUARIOS_BASE_PROTEGIDOS = [
    "propietario@beautifulstudio.com",
    "empleado1@beautifulstudio.com",
    "cliente1@beautifulstudio.com",
]


def solicitar_confirmacion() -> bool:
    mensaje = (
        "⚠️  Esta acción eliminará TODOS los registros de la base de datos.\n"
        "No se borrarán tablas ni columnas.\n"
        "Escribe EXACTAMENTE 'ELIMINAR TODO' para continuar: "
    )
    confirmacion = input(mensaje).strip()
    return confirmacion == "ELIMINAR TODO"


def vaciar_base_datos() -> None:
    """
    Vacía todas las tablas de la base de datos usando TRUNCATE CASCADE
    para manejar correctamente las foreign keys en PostgreSQL.
    Preserva los usuarios base del sistema.
    """
    with connection.cursor() as cursor:
        # Guardar IDs de usuarios protegidos y sus perfiles relacionados
        print("🔒 Guardando usuarios base del sistema...")
        usuarios_protegidos = User.objects.filter(
            email__in=USUARIOS_BASE_PROTEGIDOS
        ).values_list('id', flat=True)
        
        ids_protegidos = list(usuarios_protegidos)
        
        if ids_protegidos:
            print(f"  ✓ {len(ids_protegidos)} usuarios protegidos: {', '.join(USUARIOS_BASE_PROTEGIDOS)}")
        
        # Obtener todas las tablas de las aplicaciones Django
        tablas = []
        tablas_especiales = []  # Tablas que requieren DELETE en vez de TRUNCATE
        
        for model in apps.get_models():
            tabla = model._meta.db_table
            
            # Identificar tablas que necesitan borrado selectivo
            if tabla in ['users_user', 'empleados_empleado', 'clientes_cliente', 
                         'empleados_empleadoservicio']:
                tablas_especiales.append((tabla, model))
            else:
                tablas.append(tabla)
        
        if not tablas and not tablas_especiales:
            print("⚠️  No se encontraron tablas para vaciar.")
            return
        
        print(f"\n📋 Se encontraron {len(tablas) + len(tablas_especiales)} tablas.")
        print(f"   • {len(tablas_especiales)} tablas con registros protegidos")
        print(f"   • {len(tablas)} tablas para vaciar completamente\n")
        
        # Deshabilitar triggers de foreign key temporalmente
        cursor.execute("SET session_replication_role = 'replica';")
        
        # Manejar tablas especiales (con borrado selectivo)
        if ids_protegidos:
            print("🧹 Limpiando tablas con registros protegidos...")
            for tabla, model in tablas_especiales:
                try:
                    if tabla == 'users_user':
                        # Borrar todos los usuarios EXCEPTO los protegidos
                        eliminados = model.objects.exclude(id__in=ids_protegidos).delete()
                        print(f"  ✓ {tabla}: {eliminados[0]} registros eliminados, {len(ids_protegidos)} protegidos")
                    
                    elif tabla == 'empleados_empleado':
                        # Borrar empleados que no pertenecen a usuarios protegidos
                        eliminados = model.objects.exclude(user_id__in=ids_protegidos).delete()
                        print(f"  ✓ {tabla}: {eliminados[0]} registros eliminados")
                    
                    elif tabla == 'clientes_cliente':
                        # Borrar clientes que no pertenecen a usuarios protegidos
                        eliminados = model.objects.exclude(user_id__in=ids_protegidos).delete()
                        print(f"  ✓ {tabla}: {eliminados[0]} registros eliminados")
                    
                    elif tabla == 'empleados_empleadoservicio':
                        # Borrar relaciones de empleados no protegidos
                        eliminados = model.objects.exclude(empleado__user_id__in=ids_protegidos).delete()
                        print(f"  ✓ {tabla}: {eliminados[0]} registros eliminados")
                
                except Exception as e:
                    print(f"  ✗ Error en {tabla}: {e}")
        
        # Truncar el resto de las tablas con CASCADE
        print(f"\n🧹 Vaciando tablas restantes...")
        for tabla in tablas:
            try:
                cursor.execute(f'TRUNCATE TABLE "{tabla}" RESTART IDENTITY CASCADE;')
                print(f"  ✓ {tabla}")
            except Exception as e:
                print(f"  ✗ Error en {tabla}: {e}")
        
        # Rehabilitar triggers de foreign key
        cursor.execute("SET session_replication_role = 'origin';")


def main() -> None:
    usar_force = "--force" in sys.argv

    if not usar_force and not solicitar_confirmacion():
        print("❌ Operación cancelada.")
        return

    print("\n🧹 Vaciando base de datos (sin borrar estructura)...")
    try:
        vaciar_base_datos()
        print("\n✅ Base de datos vaciada correctamente.")
    except Exception as e:
        print(f"\n❌ Error al vaciar la base de datos: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
