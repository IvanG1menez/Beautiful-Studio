import os
import sys
import django

# Agregar el directorio padre al path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection
from django.core.management import call_command

# Deshabilitar foreign keys temporalmente
with connection.cursor() as cursor:
    cursor.execute('PRAGMA foreign_keys=OFF')

print("Aplicando migraciones pendientes...")
try:
    call_command('migrate', '--fake-initial')
    print("✅ Migraciones aplicadas correctamente")
except Exception as e:
    print(f"❌ Error: {e}")
    # Intentar marcar como aplicada manualmente
    print("\nIntentando marcar migración como aplicada...")
    call_command('migrate', 'authentication', '--fake')
    print("✅ Migración marcada como aplicada")

# Rehabilitar foreign keys
with connection.cursor() as cursor:
    cursor.execute('PRAGMA foreign_keys=ON')
