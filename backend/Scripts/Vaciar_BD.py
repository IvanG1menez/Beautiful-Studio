"""Script para vaciar completamente la base de datos.

Recorre cada tabla y borra todos los registros, respetando
el orden de dependencias de claves foráneas para evitar errores.

Ejecución:
- Como script directo:          python Scripts/Vaciar_BD.py  (desde backend/)
- Con django-extensions:        python manage.py runscript Vaciar_BD
- Con confirmación desactivada: python Scripts/Vaciar_BD.py --force
"""

import os
import sys
import django
from django.conf import settings
from django.db import connection

# Configurar Django si aún no está inicializado
# (cuando se ejecuta como script directo; runscript ya lo hace antes)
if not settings.configured:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if BASE_DIR not in sys.path:
        sys.path.insert(0, BASE_DIR)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    django.setup()


def run(force=False):
    """Vacía todas las tablas de la base de datos."""

    # ── Paso 1: confirmación ──────────────────────────────────────────────
    if not force:
        print("\n⚠️  ADVERTENCIA: Esta operación eliminará TODOS los registros")
        print("   de TODAS las tablas de la base de datos.\n")
        respuesta = (
            input("   ¿Estás seguro? Escribe 'si' para continuar: ").strip().lower()
        )
        if respuesta != "si":
            print("\n❌ Operación cancelada.\n")
            return

    print("\n🗑️  Vaciando base de datos...\n")

    def limpiar_tablas_fk_a_user_sqlite():
        """Limpia tablas con FK a users_user que no estén contempladas explícitamente.

        En SQLite, muchas tablas externas (authtoken, social_auth, simple_history, etc.)
        quedan con referencias a users_user y pueden bloquear el delete final de User.
        """

        tablas_referencia_user = []

        with connection.cursor() as cursor:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tablas = [row[0] for row in cursor.fetchall()]

            for tabla in tablas:
                if tabla == "users_user" or tabla.startswith("sqlite_"):
                    continue
                try:
                    cursor.execute(f"PRAGMA foreign_key_list({tabla})")
                    fks = cursor.fetchall()
                except Exception:
                    continue

                for fk in fks:
                    # PRAGMA foreign_key_list: (id, seq, table, from, to, on_update, on_delete, match)
                    if len(fk) >= 3 and fk[2] == "users_user":
                        tablas_referencia_user.append(tabla)
                        break

            tablas_referencia_user = sorted(set(tablas_referencia_user))

            total_limpiadas = 0
            total_registros = 0
            for tabla in tablas_referencia_user:
                try:
                    cursor.execute(f'SELECT COUNT(*) FROM "{tabla}"')
                    cantidad = cursor.fetchone()[0]
                    if cantidad > 0:
                        cursor.execute(f'DELETE FROM "{tabla}"')
                        total_registros += cantidad
                    total_limpiadas += 1
                except Exception:
                    # Si alguna tabla falla, dejamos que el resumen principal
                    # muestre el problema cuando intente borrar User.
                    continue

        if tablas_referencia_user:
            print(
                f"  ℹ️  Tablas con FK a User limpiadas: {total_limpiadas} "
                f"(registros eliminados: {total_registros})"
            )

    # ── Paso 2: importar modelos ──────────────────────────────────────────
    # Leaf tables primero (las que referencian a otras)
    from apps.turnos.models import Turno, HistorialTurno, LogReasignacion
    from apps.mercadopago.models import PagoMercadoPago
    from apps.clientes.models import Cliente, Billetera, MovimientoBilletera
    from apps.empleados.models import Empleado, EmpleadoServicio, HorarioEmpleado
    from apps.servicios.models import Servicio, CategoriaServicio, Sala
    from apps.emails.models import (
        Notificacion,
        NotificacionConfig,
        PasswordResetToken,
        AccessToken,
    )
    from apps.authentication.models import (
        PermisoAdicional,
        Configuracion,
        AuditoriaAcciones,
        ConfiguracionSSO,
        ConfiguracionGlobal,
    )
    from apps.users.models import User

    # ── Paso 3: historial de simple-history (si aplica) ───────────────────
    try:
        from simple_history.models import HistoricalRecords
        from apps.turnos.models import HistoricalTurno  # type: ignore

        historical_turno = HistoricalTurno
    except (ImportError, AttributeError):
        historical_turno = None

    # ── Paso 4: borrado en orden (leaf → parent) ──────────────────────────
    tablas = [
        # Reasignación y pagos (dependen de Turno)
        ("LogReasignacion", LogReasignacion),
        ("PagoMercadoPago", PagoMercadoPago),
        # Historial de turnos (depende de Turno y User)
        ("HistorialTurno", HistorialTurno),
        # Historial automático de simple-history
        ("HistoricalTurno", historical_turno),
        # Notificaciones (dependen de Turno y User)
        ("Notificacion", Notificacion),
        # Movimientos de billetera (dependen de Billetera y Turno)
        ("MovimientoBilletera", MovimientoBilletera),
        # Turnos
        ("Turno", Turno),
        # Billetera (depende de Cliente)
        ("Billetera", Billetera),
        # Cliente (depende de User)
        ("Cliente", Cliente),
        # Relaciones y horarios de empleados (dependen de Empleado y Servicio)
        ("EmpleadoServicio", EmpleadoServicio),
        ("HorarioEmpleado", HorarioEmpleado),
        # Empleado (depende de User)
        ("Empleado", Empleado),
        # Servicios (dependen de CategoriaServicio → Sala)
        ("Servicio", Servicio),
        ("CategoriaServicio", CategoriaServicio),
        ("Sala", Sala),
        # Tokens y configuraciones
        ("AccessToken", AccessToken),
        ("PasswordResetToken", PasswordResetToken),
        ("NotificacionConfig", NotificacionConfig),
        ("AuditoriaAcciones", AuditoriaAcciones),
        ("PermisoAdicional", PermisoAdicional),
        ("ConfiguracionSSO", ConfiguracionSSO),
        ("ConfiguracionGlobal", ConfiguracionGlobal),
        ("Configuracion", Configuracion),
    ]

    total_eliminados = 0
    errores = []

    for nombre, modelo in tablas:
        if modelo is None:
            continue
        try:
            eliminados, _ = modelo.objects.all().delete()
            total_eliminados += eliminados
            estado = f"{eliminados} registros"
            print(f"  ✅  {nombre:<25} → {estado}")
        except Exception as exc:
            errores.append((nombre, str(exc)))
            print(f"  ❌  {nombre:<25} → ERROR: {exc}")

    # Limpiar referencias externas a User (authtoken, social_auth, simple_history, etc.)
    limpiar_tablas_fk_a_user_sqlite()

    # Intentar borrar usuarios al final, cuando ya no quedan referencias
    try:
        eliminados, _ = User.objects.all().delete()
        total_eliminados += eliminados
        print(f"  ✅  {'User':<25} → {eliminados} registros")
    except Exception as exc:
        errores.append(("User", str(exc)))
        print(f"  ❌  {'User':<25} → ERROR: {exc}")

    # ── Paso 5: resumen ───────────────────────────────────────────────────
    print(f"\n{'─' * 50}")
    print(f"  Total de registros eliminados: {total_eliminados}")
    if errores:
        print(f"  Tablas con error ({len(errores)}):")
        for nombre, msg in errores:
            print(f"    - {nombre}: {msg}")
    else:
        print("  Base de datos vaciada correctamente. ✅")
    print(f"{'─' * 50}\n")


if __name__ == "__main__":
    force = "--force" in sys.argv
    run(force=force)
