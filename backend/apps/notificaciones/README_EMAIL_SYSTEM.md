# Sistema de Notificaciones y Emails - Beautiful Studio

## 📧 Descripción General

Sistema completo de notificaciones que combina notificaciones en la plataforma con envío automático de emails para profesionales y propietarios. Los clientes quedan excluidos del sistema de emails.

## 🎯 Características Principales

### Para Profesionales

- ✅ Notificaciones cuando se les asigna un nuevo turno
- ✅ Notificaciones de pagos pendientes
- ✅ Notificaciones de cancelaciones
- ✅ Notificaciones de modificaciones de turnos
- ✅ Emails con diseño HTML responsivo
- ✅ Control granular de qué notificaciones recibir

### Para Propietarios

- ✅ Notificaciones de todos los turnos del sistema
- ✅ Notificaciones de cancelaciones
- ✅ Sistema de reportes diarios (preparado para implementar)
- ✅ Emails con resumen de actividad
- ✅ Control de preferencias de notificaciones

## 📂 Estructura del Sistema

### Backend

```
backend/
├── apps/
│   ├── notificaciones/
│   │   ├── models.py              # NotificacionConfig, Notificacion
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   └── email_service.py   # EmailService con plantillas HTML
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   └── turnos/
│       ├── signals.py             # Signals para eventos de turnos
│       └── apps.py                # Registro de signals
```

### Frontend

```
frontend/
└── src/
    ├── app/
    │   └── dashboard/
    │       ├── profesional/
    │       │   └── notificaciones/
    │       │       └── page.tsx   # Config notificaciones profesional
    │       └── propietario/
    │           └── notificaciones/
    │               └── page.tsx   # Config notificaciones propietario
    └── services/
        └── notificacionesService.ts
```

## 🔔 Tipos de Notificaciones

### 1. Solicitud de Turno

**Cuándo se envía:** Al crear un nuevo turno

**Para Profesional:**

- Título: "Nuevo turno asignado"
- Contenido: Cliente, servicio, fecha/hora, duración, precio
- Email: Plantilla con gradiente purple

**Para Propietario:**

- Título: "Nuevo turno en el sistema"
- Contenido: Profesional, cliente, servicio, precio, fecha/hora

### 2. Pago Pendiente

**Cuándo se envía:** Al completar un turno sin precio_final

**Para Profesional:**

- Título: "Turno pendiente de pago"
- Contenido: Cliente, servicio, monto
- Email: Alert warning con información del pago

### 3. Cancelación de Turno

**Cuándo se envía:** Al cambiar estado a 'cancelado'

**Para Profesional y Propietario:**

- Título: "Turno cancelado"
- Contenido: Detalles del turno cancelado
- Email: Alert con información de cancelación

### 4. Modificación de Turno

**Cuándo se envía:** Al modificar fecha, hora, profesional o servicio

**Para Profesional:**

- Título: "Turno modificado"
- Contenido: Lista de cambios realizados
- Email: Comparación antes/después

### 5. Recordatorio de Turno

**Preparado para implementar**

- Se puede configurar para enviar X horas antes del turno
- Requiere tarea programada (Celery o cron)

### 6. Reporte Diario

**Preparado para implementar**

- Resumen de actividad del día
- Estadísticas de turnos completados, cancelados, ingresos
- Nuevos clientes registrados

## ⚙️ Configuración

### Variables de Entorno (Backend)

```python
# settings.py o .env

# Email Configuration (Mailtrap para desarrollo)
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'sandbox.smtp.mailtrap.io'
EMAIL_PORT = 2525
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'tu_usuario_mailtrap'
EMAIL_HOST_PASSWORD = 'tu_password_mailtrap'
DEFAULT_FROM_EMAIL = 'Beautiful Studio <noreply@beautifulstudio.com>'

# Para producción, usar servicio real
# EMAIL_HOST = 'smtp.gmail.com'
# EMAIL_PORT = 587
```

### Modelo NotificacionConfig

Controla qué notificaciones recibe cada usuario:

```python
class NotificacionConfig(models.Model):
    # Notificaciones en plataforma
    notificar_solicitud_turno = BooleanField(default=True)
    notificar_pago_turno = BooleanField(default=True)
    notificar_cancelacion_turno = BooleanField(default=True)
    notificar_modificacion_turno = BooleanField(default=True)

    # Emails
    email_solicitud_turno = BooleanField(default=True)
    email_pago_turno = BooleanField(default=True)
    email_cancelacion_turno = BooleanField(default=True)
    email_modificacion_turno = BooleanField(default=True)
    email_recordatorio_turno = BooleanField(default=True)
    email_reporte_diario = BooleanField(default=True)
```

## 🚀 Uso del Sistema

### Crear un Turno (envía notificaciones automáticamente)

```python
from apps.turnos.models import Turno

turno = Turno.objects.create(
    cliente=cliente,
    empleado=empleado,
    servicio=servicio,
    fecha_hora=fecha_turno,
    estado='pendiente'
)
# ✅ Se envían automáticamente notificaciones + emails
```

### Modificar un Turno

```python
turno.fecha_hora = nueva_fecha
turno.save()
# ✅ Se detectan los cambios y se notifica
```

### Cancelar un Turno

```python
turno.estado = 'cancelado'
turno.save()
# ✅ Se notifica a profesional y propietario
```

### Enviar Email Manualmente

```python
from apps.notificaciones.services import EmailService

# Email de nuevo turno a profesional
EmailService.enviar_email_nuevo_turno_profesional(turno)

# Email a propietario
EmailService.enviar_email_nuevo_turno_propietario(turno)

# Email de cancelación
EmailService.enviar_email_cancelacion_turno(turno, cancelado_por='cliente')

# Email de modificación
cambios = {
    'Fecha y Hora': {
        'anterior': '01/01/2025 10:00',
        'nuevo': '02/01/2025 15:00'
    }
}
EmailService.enviar_email_modificacion_turno(turno, cambios)
```

## 🧪 Testing

### Script de Prueba

```bash
cd backend
python Scripts/test_email_system.py
```

Este script:

1. ✅ Verifica la configuración de email
2. ✅ Crea un turno de prueba
3. ✅ Verifica que se creen las notificaciones
4. ✅ Permite probar modificación y cancelación
5. ✅ Muestra logs de emails enviados

### Verificar en Mailtrap

1. Ir a https://mailtrap.io
2. Iniciar sesión
3. Revisar inbox de tu proyecto
4. Ver emails con diseño HTML

## 📱 Frontend - Control de Preferencias

### Profesional

`/dashboard/profesional/notificaciones`

- Switch para cada tipo de notificación en plataforma
- Switch para cada tipo de email
- Botón "Guardar Cambios"

### Propietario

`/dashboard/propietario/notificaciones`

- Notificaciones de turnos
- Notificaciones administrativas
- Notificaciones por email
- Control de reportes diarios

## 🎨 Diseño de Emails

Todas las plantillas HTML incluyen:

- ✅ Diseño responsivo (mobile-friendly)
- ✅ Gradiente purple (#667eea → #764ba2)
- ✅ Tipografía moderna (system fonts)
- ✅ Info boxes con datos del turno
- ✅ Alerts para información importante
- ✅ Footer con branding
- ✅ Compatibilidad con clientes de email

## 🔄 Signals Implementados

### post_save en Turno (creación)

- Crea notificación para profesional
- Crea notificación para propietarios
- Envía email al profesional
- Envía email a propietarios

### pre_save en Turno (captura estado anterior)

- Almacena valores anteriores para detectar cambios

### post_save en Turno (modificación)

- Detecta cambios en fecha, estado, profesional, servicio
- Envía notificaciones de modificación
- Maneja cancelaciones
- Maneja turnos completados (pago pendiente)

## 🔮 Funcionalidades Futuras

### Recordatorios Automáticos

```python
# Implementar con Celery Beat
from celery.schedules import crontab

@app.task
def enviar_recordatorios_diarios():
    """Envía recordatorios de turnos del día siguiente"""
    turnos = Turno.objects.filter(
        fecha_hora__date=tomorrow,
        estado='confirmado'
    )
    for turno in turnos:
        EmailService.enviar_email_recordatorio_turno(turno)
```

### Reportes Diarios

```python
@app.task
def enviar_reporte_diario():
    """Envía reporte diario a propietarios"""
    datos = {
        'turnos_completados': Turno.objects.filter(
            fecha_hora__date=today,
            estado='completado'
        ).count(),
        'ingresos_totales': calcular_ingresos_dia(),
        # ... más estadísticas
    }
    EmailService.enviar_email_reporte_diario_propietario(datos)
```

### Notificaciones Push (Web)

- Implementar Web Push API
- Notificaciones del navegador
- Integración con Service Workers

## 🛠️ Mantenimiento

### Logs

Los emails registran logs en:

```python
import logging
logger = logging.getLogger(__name__)

# Ver en consola o archivo de logs
logger.info(f"Email enviado a {email}")
logger.error(f"Error: {str(e)}")
```

### Monitoring

- Revisar tasa de entrega de emails
- Monitorear bounces y spam reports
- Verificar configuración SMTP
- Revisar logs de errores

## 📋 Checklist de Implementación

- [x] Crear EmailService con plantillas HTML
- [x] Implementar signals en turnos
- [x] Agregar campos de control de emails en NotificacionConfig
- [x] Actualizar serializers y views
- [x] Migrar base de datos
- [x] Actualizar frontend (profesional y propietario)
- [x] Crear script de prueba
- [ ] Configurar servicio de email en producción
- [ ] Implementar recordatorios automáticos (Celery)
- [ ] Implementar reportes diarios
- [ ] Testing en producción

## 🤝 Contribución

Al agregar nuevos tipos de emails:

1. Agregar método en `EmailService`
2. Crear plantilla HTML responsiva
3. Actualizar signals si es necesario
4. Agregar campo de control en `NotificacionConfig`
5. Actualizar serializer
6. Actualizar frontend
7. Crear migración
8. Documentar en README

---

**Beautiful Studio** - Sistema de Notificaciones v1.0
Desarrollado con ❤️ para mejorar la experiencia de profesionales y propietarios
