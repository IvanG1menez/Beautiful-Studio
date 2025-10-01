# Beautiful Studio Backend

Backend API modular desarrollado con Django REST Framework v4.2 (LTS) para integrarse con un frontend Next.js. Diseñado para la gestión integral de un salón de belleza.

## 🚀 Características

- **Django 4.2** (Última versión LTS)
- **Django REST Framework** para API RESTful
- **CORS configurado** para Next.js frontend
- **Arquitectura modular** con apps especializadas
- **Sistema de autenticación personalizado**
- **Configuración con variables de entorno**
- **Whitenoise** para servir archivos estáticos
- **Panel de administración integrado**

## 📁 Estructura Modular

La estructura del proyecto organiza todas las aplicaciones dentro de una carpeta `apps/` para mejor organización:

```
backend/
├── beautiful_studio_backend/    # Configuración del proyecto Django
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── apps/                       # Todas las aplicaciones Django
│   ├── __init__.py
│   ├── core/                   # App base y health checks
│   ├── users/                  # Sistema de autenticación
│   ├── servicios/              # Catálogo de servicios
│   ├── clientes/               # Gestión de clientes
│   ├── empleados/              # Administración de empleados
│   └── turnos/                 # Sistema de citas
├── manage.py
├── requirements.txt
└── README.md
```

### Apps Principales

#### 🔐 **users**
- **Modelo:** Usuario personalizado con roles (admin, empleado, cliente)
- **Funciones:** Registro, login, gestión de perfiles
- **Endpoints:** `/api/users/register/`, `/api/users/login/`, `/api/users/profile/`

#### 🏢 **core**
- **Función:** Funcionalidades base y health checks
- **Endpoints:** `/api/core/health/`

#### 💼 **servicios**
- **Modelos:** CategoriaServicio, Servicio
- **Función:** Gestión del catálogo de servicios del salón
- **Endpoints:** `/api/servicios/`, `/api/servicios/categorias/`

#### � **clientes**
- **Modelo:** Perfil extendido de clientes
- **Función:** Información adicional de clientes (historial, preferencias, etc.)
- **Relación:** OneToOne con User

#### 👨‍💼 **empleados**
- **Modelos:** Empleado, EmpleadoServicio
- **Función:** Gestión de personal y especialidades
- **Relación:** OneToOne con User, ManyToMany con Servicios

#### 📅 **turnos**
- **Modelos:** Turno, HistorialTurno
- **Función:** Sistema completo de gestión de citas
- **Características:** Estados, validaciones, historial de cambios

## 📦 Instalación

1. **Navegar al directorio del backend:**
   ```bash
   cd Beautiful-Studio/backend
   ```

2. **Instalar dependencias:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configurar variables de entorno:**
   ```bash
   cp .env.example .env
   ```
   Edita el archivo `.env` según tus necesidades.

4. **Ejecutar migraciones:**
   ```bash
   python manage.py migrate
   ```

5. **Crear superusuario:**
   ```bash
   python manage.py createsuperuser
   ```

6. **Iniciar el servidor de desarrollo:**
   ```bash
   python manage.py runserver
   ```

## 🌐 Endpoints Disponibles

### Autenticación
- `POST /api/users/register/` - Registro de usuarios
- `POST /api/users/login/` - Login (retorna token)
- `POST /api/users/logout/` - Logout
- `GET/PUT /api/users/profile/` - Perfil del usuario

### Servicios
- `GET/POST /api/servicios/` - Listar/crear servicios
- `GET/PUT/DELETE /api/servicios/{id}/` - Detalle de servicio
- `GET/POST /api/servicios/categorias/` - Categorías de servicios
- `GET /api/servicios/categoria/{id}/` - Servicios por categoría

### Administración
- `GET /admin/` - Panel de administración Django
- `GET /api/core/health/` - Health check del sistema

## 🔧 Configuración para Next.js

El backend está preconfigurado para trabajar con Next.js:

- **CORS habilitado** para `localhost:3000` y `127.0.0.1:3000`
- **Autenticación por tokens** para API requests
- **Serializadores optimizados** para JSON
- **Paginación configurada** (20 elementos por página)

### Ejemplo de uso desde Next.js

```javascript
// Login
const response = await fetch('http://127.0.0.1:8000/api/users/login/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'usuario@email.com',
    password: 'password123'
  })
});

const data = await response.json();
// data.token contiene el token de autenticación
// data.user contiene la información del usuario

// Usar token en requests autenticados
const servicesResponse = await fetch('http://127.0.0.1:8000/api/servicios/', {
  headers: {
    'Authorization': `Token ${token}`,
    'Content-Type': 'application/json',
  }
});
```

## 🗃️ Modelos de Datos

### Relaciones Principales

```
User (1:1) ← Cliente
User (1:1) ← Empleado

CategoriaServicio (1:N) → Servicio
Empleado (N:M) ← EmpleadoServicio → Servicio

Cliente (1:N) → Turno ← (N:1) Empleado
Servicio (1:N) → Turno

Turno (1:N) → HistorialTurno
User (1:N) → HistorialTurno
```

### Campos Principales

- **User:** email, roles, teléfono, timestamps
- **Servicio:** nombre, precio, duración, categoría
- **Turno:** fecha/hora, estado, notas, validaciones
- **Cliente:** preferencias, historial, status VIP
- **Empleado:** especialidades, horarios, comisiones

## 🔐 Sistema de Autenticación

- **Usuario personalizado** basado en email
- **Roles diferenciados:** admin, empleado, cliente
- **Autenticación por tokens** para API
- **Permisos granulares** por endpoint

## 🛠️ Desarrollo

### Comandos útiles

```bash
# Verificar configuración
python manage.py check

# Crear migraciones
python manage.py makemigrations

# Ver SQL de migraciones
python manage.py sqlmigrate app_name migration_name

# Shell de Django
python manage.py shell

# Recopilar archivos estáticos
python manage.py collectstatic
```

### Añadir nuevas funcionalidades

1. **Crear nueva app:** `python manage.py startapp nueva_app`
2. **Agregar a INSTALLED_APPS** en `settings.py`
3. **Crear modelos** en `models.py`
4. **Crear serializadores** en `serializers.py`
5. **Crear vistas** en `views.py`
6. **Configurar URLs** en `urls.py`
7. **Registrar en admin** en `admin.py`
8. **Crear migraciones:** `python manage.py makemigrations`
9. **Aplicar migraciones:** `python manage.py migrate`

## 📋 Próximos Pasos

1. **Implementar sistema de turnos completo** (vistas y endpoints)
2. **Agregar sistema de notificaciones**
3. **Implementar reportes y estadísticas**
4. **Añadir sistema de pagos**
5. **Configurar base de datos en producción** (PostgreSQL)
6. **Implementar tests automatizados**
7. **Configurar CI/CD**

## 🔐 Seguridad en Producción

- [ ] Cambiar `SECRET_KEY` 
- [ ] Configurar `ALLOWED_HOSTS`
- [ ] Desactivar `DEBUG`
- [ ] Configurar CORS específicamente
- [ ] Implementar rate limiting
- [ ] Configurar HTTPS
- [ ] Implementar logs de auditoría

## 📚 Recursos

- [Django Documentation](https://docs.djangoproject.com/en/4.2/)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [Next.js Documentation](https://nextjs.org/docs)