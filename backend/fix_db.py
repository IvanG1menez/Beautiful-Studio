"""Script para arreglar problemas de integridad en la base de datos"""
import sqlite3

# Conectar a la base de datos
conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()

print("Arreglando base de datos...")

# 1. Eliminar clientes con user_id inválido
print("\n1. Eliminando clientes con user_id inválido...")
cursor.execute("""
    DELETE FROM clientes_cliente 
    WHERE user_id NOT IN (SELECT id FROM users_user)
""")
print(f"   Eliminados: {cursor.rowcount} clientes")

# 2. Eliminar empleados con user_id inválido
print("\n2. Eliminando empleados con user_id inválido...")
cursor.execute("""
    DELETE FROM empleados_empleado 
    WHERE user_id NOT IN (SELECT id FROM users_user)
""")
print(f"   Eliminados: {cursor.rowcount} empleados")

# 3. Eliminar historial de turnos con turno_id inválido
print("\n3. Eliminando historial de turnos con turno_id inválido...")
cursor.execute("""
    DELETE FROM turnos_historialturno 
    WHERE turno_id NOT IN (SELECT id FROM turnos_turno)
""")
print(f"   Eliminados: {cursor.rowcount} registros de historial")

# 4. Eliminar notificaciones con user_id inválido
print("\n4. Eliminando notificaciones con user_id inválido...")
cursor.execute("""
    DELETE FROM notificaciones_notificacion 
    WHERE user_id NOT IN (SELECT id FROM users_user)
""")
print(f"   Eliminados: {cursor.rowcount} notificaciones")

# Guardar cambios
conn.commit()
conn.close()

print("\n✓ Base de datos arreglada")
