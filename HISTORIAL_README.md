# Sistema de Historial con django-simple-history

## 📋 Descripción

Sistema completo de auditoría y versionado de datos críticos usando `django-simple-history`. Permite rastrear todos los cambios realizados en Turnos, Servicios y Clientes, identificando quién hizo cada modificación y cuándo.

## 🎯 Características

### Modelos con Historial

- ✅ **Turnos** - Tracking completo de cambios en citas
- ✅ **Servicios** - Historial de precios y configuraciones
- ✅ **Clientes** - Auditoría de información de clientes

### Rastreo de Usuarios

- **Dashboard**: Cambios realizados por usuarios autenticados se registran automáticamente
- **Celery/Sistema**: Cambios automáticos se asignan al usuario especial "system@local"

### Funcionalidades

- 📊 Vista completa del historial en el Dashboard del Propietario
- 🔍 Filtros por modelo y objeto
- 📄 Paginación de registros
- ↩️ Restauración de versiones anteriores (Turnos)
- 👤 Identificación del usuario que realizó cada cambio
- 📝 Razón del cambio personalizable

## 🛠️ Implementación Técnica

### Backend (Django)

#### Modelos

Cada modelo crítico incluye:

```python
from simple_history.models import HistoricalRecords

class Turno(models.Model):
    # ... campos del modelo ...
    history = HistoricalRecords()
```

#### Middleware

En `settings.py`:

```python
MIDDLEWARE = [
    # ...
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'simple_history.middleware.HistoryRequestMiddleware',  # Después de Auth
    # ...
]
```

#### Cambios desde Celery

Para tareas asíncronas que modifican datos:

```python
from apps.turnos.utils import get_system_history_user

turno._history_user = get_system_history_user()
turno.save()
```

### Frontend (Next.js)

#### Navegación

Nueva sección "Historial" en el sidebar del Dashboard del Propietario (entre Encuestas y Notificaciones).

#### Página de Historial

- Ubicación: `/dashboard/propietario/historial`
- Características:
  - Tabla con todos los cambios
  - Filtros por modelo (Turno, Servicio, Cliente)
  - Búsqueda por ID de objeto
  - Paginación
  - Botón de restauración para turnos

## 📡 API Endpoints

### Listar Historial

```
GET /api/turnos/historial/listar/
```

**Parámetros:**

- `modelo` (opcional): "turno", "servicio", "cliente"
- `objeto_id` (opcional): ID del objeto específico
- `page`: Número de página (default: 1)
- `page_size`: Registros por página (default: 50)

**Respuesta:**

```json
{
  "count": 150,
  "next": true,
  "previous": false,
  "total_pages": 8,
  "current_page": 1,
  "results": [
    {
      "id": 123,
      "modelo": "Turno",
      "objeto_id": 45,
      "accion": "Modificado",
      "history_type": "~",
      "usuario": {
        "id": 1,
        "nombre": "Juan Pérez",
        "email": "juan@example.com"
      },
      "fecha": "2026-02-07T14:30:00Z",
      "cambio_razon": "Actualización de estado",
      "datos": { ... }
    }
  ]
}
```

### Detalle de Registro Histórico

```
GET /api/turnos/historial/<modelo>/<history_id>/
```

### Restaurar desde Historial

```
POST /api/turnos/historial/turno/<history_id>/restaurar/
```

## 🔐 Permisos

Solo usuarios con rol `propietario` o `superusuario` pueden:

- Ver el historial completo
- Restaurar versiones anteriores

## 💡 Casos de Uso

### 1. Auditoría de Cambios

Ver quién modificó un turno y cuándo:

```
Dashboard → Historial → Filtrar por "Turno" → Buscar ID
```

### 2. Restaurar un Turno Cancelado por Error

```
1. Encontrar el registro antes de la cancelación
2. Click en "Restaurar"
3. El turno vuelve a su estado anterior
```

### 3. Rastrear Cambios de Precios

```
Dashboard → Historial → Filtrar por "Servicio"
Ver historial completo de cambios de precio
```

### 4. Verificar Cambios Automáticos

```
Filtrar por usuario "System Process"
Ver todos los cambios realizados por Celery
```

## 📊 Tablas de Base de Datos

El sistema crea tablas automáticas:

- `historical_turno` - Historial de turnos
- `historical_servicio` - Historial de servicios
- `historical_cliente` - Historial de clientes

Cada tabla incluye:

- Todos los campos del modelo original
- `history_id` - ID único del registro histórico
- `history_date` - Fecha del cambio
- `history_type` - Tipo: '+' (creado), '~' (modificado), '-' (eliminado)
- `history_user_id` - Usuario que realizó el cambio
- `history_change_reason` - Razón del cambio

## 🚀 Migraciones

Después de la instalación:

```bash
python manage.py makemigrations
python manage.py migrate
```

Esto creará:

- Tablas históricas
- Índices para búsquedas eficientes
- Usuario de sistema (system@local)

## 🎨 Interfaz de Usuario

### Badges de Acción

- 🟢 **Creado** - Nuevo registro
- 🔵 **Modificado** - Actualización
- 🔴 **Eliminado** - Borrado (soft delete)

### Información Mostrada

- Fecha y hora del cambio
- Modelo afectado
- ID del objeto
- Usuario responsable
- Razón del cambio
- Botón de restauración (cuando aplica)

## 📝 Notas Importantes

1. **Performance**: El historial crece con el tiempo. Considera implementar archivado para registros antiguos.

2. **Cambios Masivos**: Los `QuerySet.update()` NO generan historial. Usa `.save()` en loops si necesitas historial.

3. **Restauración**: Solo implementada para Turnos. Servicios y Clientes requieren implementación adicional.

4. **Usuario Sistema**: Creado automáticamente al primer uso. Email: `system@local`, inactivo.

5. **Admin Django**: Los modelos también tienen historial visible en el admin con `SimpleHistoryAdmin`.

## 🔧 Mantenimiento

### Ver Registros Históricos en Shell

```python
from apps.turnos.models import Turno

# Todos los cambios de un turno
turno = Turno.objects.get(id=1)
for h in turno.history.all():
    print(f"{h.history_date}: {h.history_type} por {h.history_user}")

# Último cambio
ultimo = turno.history.first()

# Comparar versiones
version_anterior = turno.history.all()[1]
```

### Limpiar Historial Antiguo (Opcional)

```python
from datetime import datetime, timedelta
from apps.turnos.models import Turno

# Eliminar historial de más de 1 año
fecha_limite = datetime.now() - timedelta(days=365)
Turno.history.filter(history_date__lt=fecha_limite).delete()
```

## 📚 Recursos

- Documentación: [django-simple-history](https://django-simple-history.readthedocs.io/)
- Código backend: `/backend/apps/turnos/views_historial.py`
- Código frontend: `/frontend/src/app/dashboard/propietario/historial/page.tsx`
- Utilidades: `/backend/apps/turnos/utils.py`
