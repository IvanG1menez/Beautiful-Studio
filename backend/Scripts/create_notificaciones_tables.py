import os
import sys
import django

# Agregar el directorio padre al path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection

# SQL para crear las tablas
sql_create_notificacion_config = """
CREATE TABLE IF NOT EXISTS "notificaciones_notificacionconfig" (
    "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
    "notificar_solicitud_turno" bool NOT NULL,
    "notificar_pago_turno" bool NOT NULL,
    "notificar_cancelacion_turno" bool NOT NULL,
    "notificar_modificacion_turno" bool NOT NULL,
    "notificar_nuevo_empleado" bool NOT NULL,
    "notificar_nuevo_cliente" bool NOT NULL,
    "notificar_reporte_diario" bool NOT NULL,
    "created_at" datetime NOT NULL,
    "updated_at" datetime NOT NULL,
    "user_id" bigint NOT NULL UNIQUE REFERENCES "users_user" ("id") DEFERRABLE INITIALLY DEFERRED
);
"""

sql_create_notificacion = """
CREATE TABLE IF NOT EXISTS "notificaciones_notificacion" (
    "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" varchar(50) NOT NULL,
    "titulo" varchar(200) NOT NULL,
    "mensaje" text NOT NULL,
    "leida" bool NOT NULL,
    "data" text NULL,
    "created_at" datetime NOT NULL,
    "leida_at" datetime NULL,
    "usuario_id" bigint NOT NULL REFERENCES "users_user" ("id") DEFERRABLE INITIALLY DEFERRED
);
"""

sql_create_index1 = """
CREATE INDEX IF NOT EXISTS "notificacio_usuario_15c13d_idx" ON "notificaciones_notificacion" ("usuario_id", "created_at" DESC);
"""

sql_create_index2 = """
CREATE INDEX IF NOT EXISTS "notificacio_usuario_2c9179_idx" ON "notificaciones_notificacion" ("usuario_id", "leida");
"""

sql_insert_migration = """
INSERT OR IGNORE INTO django_migrations (app, name, applied)
VALUES ('notificaciones', '0001_initial', datetime('now'));
"""

print("Creando tablas de notificaciones...")
with connection.cursor() as cursor:
    cursor.execute(sql_create_notificacion_config)
    cursor.execute(sql_create_notificacion)
    cursor.execute(sql_create_index1)
    cursor.execute(sql_create_index2)
    cursor.execute(sql_insert_migration)

print("✅ Tablas creadas correctamente")
