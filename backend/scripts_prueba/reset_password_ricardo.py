import sqlite3
from werkzeug.security import generate_password_hash

conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()

# Resetear contraseña para el usuario ricardo.prieto98@hotmail.com
# Django usa el formato: pbkdf2_sha256$iterations$salt$hash

# Contraseña: password123
# Hash generado por Django para "password123"
nueva_password = "pbkdf2_sha256$870000$fDHZy9xKkGH9YcVtCWYSA2$HMI7g3R6jZbQb3eKO/Y0yWPEFJ9LgJDhJz3c3Q7HiGQ="

cursor.execute('''
    UPDATE users_user 
    SET password = ?
    WHERE email = ?
''', (nueva_password, "ricardo.prieto98@hotmail.com"))

conn.commit()

print(f"Contraseña actualizada para ricardo.prieto98@hotmail.com")
print(f"Nueva contraseña: password123")
print(f"Filas actualizadas: {cursor.rowcount}")

conn.close()
