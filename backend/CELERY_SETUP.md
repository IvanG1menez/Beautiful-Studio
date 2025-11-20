# 🚀 Configuración de Celery y Redis - Beautiful Studio

## ✅ Estado Actual

La infraestructura de Celery está **instalada y configurada** pero **NO activa** para permitir que el sistema funcione sin Redis.

### Instalado:

- ✅ Celery 5.5.3
- ✅ Redis client 7.1.0
- ✅ django-celery-beat 2.8.1
- ✅ django-celery-results 2.6.0

### Configurado:

- ✅ `core/celery.py` - Configuración de Celery
- ✅ `core/__init__.py` - Auto-carga de Celery
- ✅ `core/settings.py` - Variables de configuración
- ✅ Migraciones aplicadas

### Tareas Creadas:

- ✅ `enviar_recordatorios_turnos` - Recordatorios 24h antes
- ✅ `enviar_reporte_diario_propietarios` - Reporte a las 8PM
- ✅ `limpiar_notificaciones_antiguas` - Limpieza de notificaciones
- ✅ `procesar_resultado_encuesta` - Procesamiento asíncrono de encuestas

## 🔧 Para Activar Celery (Cuando estés listo)

### 1. Instalar Redis en Windows

**Opción A: Redis for Windows (MSOpenTech)**

```bash
# Descargar desde GitHub
# https://github.com/microsoftarchive/redis/releases
# Instalar Redis-x64-3.2.100.msi

# Verificar instalación
redis-cli ping
# Debería responder: PONG
```

**Opción B: Usar Redis en Docker**

```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

**Opción C: Usar WSL2 con Redis**

```bash
wsl --install
# En WSL:
sudo apt-get update
sudo apt-get install redis-server
sudo service redis-server start
```

### 2. Iniciar Celery Worker

```bash
cd backend
venv\Scripts\activate

# Worker principal
celery -A core worker -l info --pool=solo

# En otra terminal - Celery Beat (tareas programadas)
celery -A core beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

### 3. Monitorear Tareas (Opcional)

**Flower - Dashboard Web**

```bash
pip install flower
celery -A core flower
# Abre http://localhost:5555
```

### 4. Variables de Entorno

Agregar a `.env`:

```
CELERY_BROKER_URL=redis://localhost:6379/0
```

## 📋 Tareas Programadas Configuradas

### Recordatorios de Turnos

- **Horario:** Todos los días a las 9:00 AM
- **Función:** Envía emails recordatorios 24h antes del turno
- **Destinatarios:** Profesionales con turnos confirmados

### Reportes Diarios

- **Horario:** Todos los días a las 8:00 PM
- **Función:** Resumen de actividad del día
- **Destinatarios:** Propietarios
- **Incluye:**
  - Turnos completados
  - Turnos cancelados
  - Turnos pendientes
  - Ingresos totales
  - Nuevos clientes

### Limpieza de Notificaciones

- **Horario:** Semanal (configurable)
- **Función:** Elimina notificaciones leídas antiguas
- **Por defecto:** 90 días

## 🔄 Migrar a Celery (Reactivar tareas asíncronas)

### Actualizar serializers.py de encuestas

Cambiar de:

```python
procesar_resultado_encuesta(encuesta.id)
```

A:

```python
procesar_resultado_encuesta.delay(encuesta.id)
```

### Actualizar signals.py de encuestas

Cambiar de:

```python
send_mail(...)
```

A:

```python
enviar_encuesta_post_servicio.delay(turno_id=instance.id)
```

## 🎯 Comandos Útiles

### Verificar tareas registradas

```bash
celery -A core inspect registered
```

### Ver tareas activas

```bash
celery -A core inspect active
```

### Purgar todas las tareas

```bash
celery -A core purge
```

### Reiniciar workers

```bash
celery -A core control shutdown
# Luego reiniciar con:
celery -A core worker -l info --pool=solo
```

## 🐛 Troubleshooting

### Error: "redis.exceptions.ConnectionError"

- Redis no está corriendo
- Solución: `redis-server` o iniciar servicio de Redis

### Error: "kombu.exceptions.OperationalError"

- Broker no disponible
- Verificar CELERY_BROKER_URL en settings

### Error: "Task timeout"

- Aumentar CELERY_TASK_TIME_LIMIT en settings

### Tareas no se ejecutan

- Verificar que Celery Beat esté corriendo
- Revisar logs: `celery -A core beat -l debug`

## 📊 Configuración de Producción

```python
# settings.py (producción)
CELERY_BROKER_URL = 'redis://redis-server:6379/0'
CELERY_RESULT_BACKEND = 'redis://redis-server:6379/1'
CELERY_TASK_ALWAYS_EAGER = False  # No ejecutar tareas síncronamente
CELERY_TASK_EAGER_PROPAGATES = False
```

## 🚦 Estado de Tareas

| Tarea                    | Estado                      | Requiere Redis |
| ------------------------ | --------------------------- | -------------- |
| Recordatorios de turnos  | ✅ Lista                    | Sí             |
| Reporte diario           | ✅ Lista                    | Sí             |
| Procesar encuesta        | ✅ Lista                    | Sí             |
| Limpiar notificaciones   | ✅ Lista                    | Sí             |
| Emails de notificaciones | ✅ Funcionando (sin Celery) | No             |

## 💡 Recomendaciones

1. **Para desarrollo local:** Usar Redis en Docker es lo más simple
2. **Para producción:** Usar servicio managed de Redis (AWS ElastiCache, Redis Cloud, etc.)
3. **Monitoreo:** Instalar Flower para visualizar tareas
4. **Logs:** Configurar logging adecuado para debugging

---

**Nota:** El sistema funciona **perfectamente sin Celery** por ahora. Los emails se envían síncronamente. Celery es opcional para mejorar performance y habilitar tareas programadas.
