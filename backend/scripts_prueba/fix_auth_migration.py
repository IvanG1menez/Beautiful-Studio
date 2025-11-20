import os
import sys
import django

# Agregar el directorio padre al path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection

# Insertar directamente en la tabla de migraciones
sql_insert = """
INSERT OR IGNORE INTO django_migrations (app, name, applied)
VALUES ('authentication', '0001_initial', datetime('now'));
"""

print("Marcando migración authentication.0001_initial como aplicada...")
with connection.cursor() as cursor:
    cursor.execute(sql_insert)

print("✅ Migración marcada correctamente")

# Verificar
with connection.cursor() as cursor:
    cursor.execute("SELECT * FROM django_migrations WHERE app = 'authentication'")
    rows = cursor.fetchall()
    print(f"\nMigraciones de authentication: {len(rows)}")
    for row in rows:
        print(f"  - {row[1]}")
