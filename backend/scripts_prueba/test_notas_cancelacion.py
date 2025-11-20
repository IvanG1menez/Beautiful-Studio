"""
Script para verificar que las notas del empleado se guardan correctamente
cuando se cancela un turno y que aparecen en la respuesta del API.
"""
import sqlite3

# Conectar a la base de datos
conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()

print("=" * 60)
print("VERIFICACIÓN DE NOTAS DE EMPLEADO EN TURNOS CANCELADOS")
print("=" * 60)

# Consultar turnos cancelados con notas del empleado
cursor.execute('''
    SELECT 
        t.id,
        t.estado,
        t.notas_cliente,
        t.notas_empleado,
        t.fecha_hora
    FROM turnos_turno t
    WHERE t.estado = 'cancelado'
    ORDER BY t.id DESC
    LIMIT 10
''')

turnos_cancelados = cursor.fetchall()

print(f"\nTotal de turnos cancelados: {len(turnos_cancelados)}")

if turnos_cancelados:
    print("\n" + "=" * 60)
    print("TURNOS CANCELADOS (últimos 10):")
    print("=" * 60)
    
    for turno in turnos_cancelados:
        turno_id, estado, notas_cliente, notas_empleado, fecha = turno
        print(f"\nID: {turno_id}")
        print(f"Estado: {estado}")
        print(f"Fecha: {fecha}")
        print(f"Notas del cliente: [{notas_cliente or 'Sin notas'}]")
        print(f"Notas del empleado: [{notas_empleado or 'Sin notas'}]")
        print("-" * 60)
else:
    print("\nNo se encontraron turnos cancelados")

# Estadísticas
print("\n" + "=" * 60)
print("ESTADÍSTICAS:")
print("=" * 60)

cursor.execute('''
    SELECT COUNT(*) 
    FROM turnos_turno 
    WHERE estado = 'cancelado' AND notas_empleado IS NOT NULL AND notas_empleado != ''
''')
cancelados_con_notas = cursor.fetchone()[0]

cursor.execute('''
    SELECT COUNT(*) 
    FROM turnos_turno 
    WHERE estado = 'cancelado'
''')
total_cancelados = cursor.fetchone()[0]

print(f"Total turnos cancelados: {total_cancelados}")
print(f"Cancelados con notas del empleado: {cancelados_con_notas}")
print(f"Porcentaje con notas: {(cancelados_con_notas/total_cancelados*100) if total_cancelados > 0 else 0:.1f}%")

conn.close()

print("\n" + "=" * 60)
print("VERIFICACIÓN COMPLETADA")
print("=" * 60)
