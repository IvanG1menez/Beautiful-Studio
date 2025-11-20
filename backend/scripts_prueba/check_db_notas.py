import sqlite3

# Conectar a la base de datos
conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()

# Consultar turnos con notas
cursor.execute('''
    SELECT id, notas_cliente, fecha_hora, estado 
    FROM turnos_turno 
    WHERE notas_cliente IS NOT NULL AND notas_cliente != ''
    ORDER BY id DESC
''')

rows = cursor.fetchall()

print(f'Total de turnos con notas: {len(rows)}')
print('\n=== Primeros 20 turnos con notas ===')
for r in rows[:20]:
    turno_id, notas, fecha, estado = r
    print(f'ID {turno_id}: [{notas}] (len={len(notas)}) - Estado: {estado}')

print('\n\n=== Notas de 1-3 caracteres ===')
notas_cortas = [r for r in rows if len(r[1]) <= 3]

if notas_cortas:
    for r in notas_cortas:
        turno_id, notas, fecha, estado = r
        print(f'ID {turno_id}: [{notas}] (len={len(notas)}) - Estado: {estado}')
else:
    print('No se encontraron notas de 1-3 caracteres')

conn.close()
