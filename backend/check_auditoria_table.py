from django.db import connection

cursor = connection.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%auditoria%'")
tables = [row[0] for row in cursor.fetchall()]

print(f'Tablas de auditoria encontradas: {tables}')

# Verificar si existe la tabla
if 'authentication_auditoriaacciones' in tables:
    print('✅ La tabla authentication_auditoriaacciones EXISTE')
else:
    print('❌ La tabla authentication_auditoriaacciones NO EXISTE')
    print('\nCreando la tabla...')
    
    # Intentar crear la tabla manualmente
    from apps.authentication.models import AuditoriaAcciones
    from django.db import connection
    from django.core.management import call_command
    
    # Recrear tabla
    call_command('migrate', 'authentication', '--fake-initial')
