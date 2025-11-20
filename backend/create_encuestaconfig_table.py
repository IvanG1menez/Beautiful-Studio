import sqlite3

# Crear tabla encuestas_encuestaconfig
conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()

create_table_sql = """
CREATE TABLE IF NOT EXISTS encuestas_encuestaconfig (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    umbral_negativa INTEGER NOT NULL DEFAULT 4,
    umbral_neutral_min INTEGER NOT NULL DEFAULT 5,
    umbral_neutral_max INTEGER NOT NULL DEFAULT 7,
    umbral_notificacion_propietario INTEGER NOT NULL DEFAULT 3,
    dias_ventana_alerta INTEGER NOT NULL DEFAULT 30,
    email_override_debug VARCHAR(254) NOT NULL DEFAULT 'gimenezivanb@gmail.com',
    activo INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
"""

cursor.execute(create_table_sql)
conn.commit()

# Insertar configuración por defecto
from datetime import datetime
now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

cursor.execute("""
    INSERT OR IGNORE INTO encuestas_encuestaconfig 
    (id, umbral_negativa, umbral_neutral_min, umbral_neutral_max, 
     umbral_notificacion_propietario, dias_ventana_alerta, 
     email_override_debug, activo, created_at, updated_at)
    VALUES (1, 4, 5, 7, 3, 30, 'gimenezivanb@gmail.com', 1, ?, ?)
""", (now, now))

conn.commit()
conn.close()

print('✅ Tabla encuestas_encuestaconfig creada')
print('✅ Configuración por defecto insertada')
