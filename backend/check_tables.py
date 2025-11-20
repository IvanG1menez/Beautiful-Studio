import sqlite3

conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'encuestas%' ORDER BY name")
tables = cursor.fetchall()
conn.close()

print('Tablas de encuestas:')
for table in tables:
    print(f'  - {table[0]}')
