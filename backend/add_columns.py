"""Script para agregar las columnas necesarias manualmente"""
import sqlite3

# Conectar a la base de datos
conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()

print("Agregando columnas faltantes...")

try:
    # Agregar columnas a empleados
    print("\n1. Agregando promedio_calificacion a empleados...")
    cursor.execute("""
        ALTER TABLE empleados_empleado 
        ADD COLUMN promedio_calificacion DECIMAL(3, 2) DEFAULT 0.00
    """)
    print("   ✓ Columna agregada")
except sqlite3.OperationalError as e:
    print(f"   - Ya existe o error: {e}")

try:
    print("\n2. Agregando total_encuestas a empleados...")
    cursor.execute("""
        ALTER TABLE empleados_empleado 
        ADD COLUMN total_encuestas INTEGER DEFAULT 0
    """)
    print("   ✓ Columna agregada")
except sqlite3.OperationalError as e:
    print(f"   - Ya existe o error: {e}")

# Guardar cambios
conn.commit()
conn.close()

print("\n✓ Columnas agregadas correctamente")
