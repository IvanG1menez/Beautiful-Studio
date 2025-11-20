# Scripts de Prueba y Utilidades

Esta carpeta contiene scripts de prueba, debugging y utilidades que se usaron durante el desarrollo.

## Categorías de Scripts

### Scripts de Verificación y Testing

- `test_*.py` - Scripts para probar diferentes funcionalidades
- `verify_*.py` - Scripts para verificar estados del sistema
- `verificar_*.py` - Scripts de verificación en español
- `check_*.py` - Scripts para revisar estados de la base de datos

### Scripts de Generación de Datos

- `generate_*.py` - Scripts para generar datos de prueba
- `create_test_turno.py` - Crear turnos de prueba

### Scripts de Utilidades

- `reset_*.py` - Scripts para resetear datos
- `auto_reset_admin.py` - Reseteo automático del admin
- `limpiar_turnos.py` - Limpiar turnos de prueba
- `listar_*.py` - Scripts para listar información

### Scripts de Migraciones y Fixes

- `migrate_roles.py` - Migración de roles
- `fix_*.py` - Scripts de corrección
- `relacionar_empleados_servicios.py` - Relacionar empleados con servicios

### Documentación

- `*.md` - Documentación de procesos y credenciales
- `*.bat` - Scripts batch para testing

## Nota Importante

**TODOS los nuevos scripts de prueba deben crearse en esta carpeta.**

Los scripts productivos de migraciones se mantienen en `backend/Scripts/`.
