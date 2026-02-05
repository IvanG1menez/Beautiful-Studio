"""
Script para actualizar las referencias de migraciones de notificaciones a emails
"""

import os
import sys
import django

# Configurar Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.db import connection

print("=" * 70)
print("ACTUALIZACIÓN DE MIGRACIONES: notificaciones -> emails")
print("=" * 70)

with connection.cursor() as cursor:
    # Actualizar registros de migraciones
    cursor.execute(
        """
        UPDATE django_migrations 
        SET app = 'emails' 
        WHERE app = 'notificaciones'
    """
    )

    rows_updated = cursor.rowcount
    print(f"\n✅ {rows_updated} registros de migraciones actualizados")

print("\n" + "=" * 70)
print("Migraciones actualizadas exitosamente")
print("=" * 70)
