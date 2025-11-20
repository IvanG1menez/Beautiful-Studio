import sqlite3

conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()

# Obtener el cliente del turno cancelado ID 98
cursor.execute('''
    SELECT 
        t.id as turno_id,
        c.id as cliente_id,
        u.email,
        u.first_name,
        u.last_name
    FROM turnos_turno t
    JOIN clientes_cliente c ON t.cliente_id = c.id
    JOIN users_user u ON c.user_id = u.id
    WHERE t.id = 98
''')

result = cursor.fetchone()

if result:
    turno_id, cliente_id, email, nombre, apellido = result
    print(f"Turno ID: {turno_id}")
    print(f"Cliente ID: {cliente_id}")
    print(f"Email: {email}")
    print(f"Nombre: {nombre} {apellido}")
else:
    print("No se encontró el turno 98")

conn.close()
