"""
Script para agregar las 10 columnas de preguntas a la tabla de encuestas
"""

import sqlite3
import os

# Ruta a la base de datos
db_path = os.path.join(os.path.dirname(__file__), 'db.sqlite3')

# Conectar a la base de datos
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("🔧 Agregando columnas de preguntas a la tabla encuestas_encuesta...")

# Lista de columnas a agregar
columnas = [
    ('cliente_id', 'INTEGER NULL'),
    ('empleado_id', 'INTEGER NULL'),
    ('pregunta1_calidad_servicio', 'INTEGER NOT NULL DEFAULT 5'),
    ('pregunta2_profesionalismo', 'INTEGER NOT NULL DEFAULT 5'),
    ('pregunta3_puntualidad', 'INTEGER NOT NULL DEFAULT 5'),
    ('pregunta4_limpieza', 'INTEGER NOT NULL DEFAULT 5'),
    ('pregunta5_atencion', 'INTEGER NOT NULL DEFAULT 5'),
    ('pregunta6_resultado', 'INTEGER NOT NULL DEFAULT 5'),
    ('pregunta7_precio', 'INTEGER NOT NULL DEFAULT 5'),
    ('pregunta8_comodidad', 'INTEGER NOT NULL DEFAULT 5'),
    ('pregunta9_comunicacion', 'INTEGER NOT NULL DEFAULT 5'),
    ('pregunta10_recomendacion', 'INTEGER NOT NULL DEFAULT 5'),
]

# Verificar qué columnas ya existen
cursor.execute("PRAGMA table_info(encuestas_encuesta)")
columnas_existentes = [row[1] for row in cursor.fetchall()]

# Agregar solo las columnas que no existen
for nombre_columna, tipo_sql in columnas:
    if nombre_columna in columnas_existentes:
        print(f"  ⏭️  {nombre_columna} ya existe, saltando...")
    else:
        try:
            cursor.execute(f"ALTER TABLE encuestas_encuesta ADD COLUMN {nombre_columna} {tipo_sql}")
            print(f"  ✅ {nombre_columna} agregada exitosamente")
        except sqlite3.OperationalError as e:
            print(f"  ❌ Error al agregar {nombre_columna}: {e}")

# También modificar el campo puntaje para que sea DECIMAL
try:
    # SQLite no soporta ALTER COLUMN, pero podemos agregar una nueva columna temporal
    # y luego copiar los datos. Por ahora solo verificamos que exista.
    if 'puntaje' in columnas_existentes:
        print(f"  ✅ Campo 'puntaje' ya existe")
    else:
        cursor.execute("ALTER TABLE encuestas_encuesta ADD COLUMN puntaje REAL NOT NULL DEFAULT 5.0")
        print(f"  ✅ Campo 'puntaje' agregado como REAL (decimal)")
except Exception as e:
    print(f"  ℹ️  Campo puntaje: {e}")

# Guardar cambios
conn.commit()
conn.close()

print("\n✅ Proceso completado!")
print("📊 Ahora la tabla encuestas_encuesta tiene las 10 columnas de preguntas")
