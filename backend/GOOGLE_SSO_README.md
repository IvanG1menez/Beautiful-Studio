# Sistema de Google SSO (Single Sign-On)

## 📋 Descripción

Sistema completo de autenticación con Google OAuth 2.0 que permite a los usuarios iniciar sesión o registrarse utilizando su cuenta de Google. El sistema incluye un panel de configuración para el propietario donde puede activar/desactivar el SSO y gestionar las credenciales.

## ✨ Características

- ✅ Botón "Continuar con Google" en login y registro
- ✅ Renderizado condicional del botón según configuración
- ✅ Panel de configuración para el propietario
- ✅ Autocreación de perfil de Cliente para usuarios OAuth
- ✅ Pipeline personalizado de autenticación
- ✅ Credenciales configurables desde admin o dashboard
- ✅ Modelo Singleton para configuración única
- ✅ Endpoints públicos y privados

## 🏗️ Arquitectura

### Backend (Django)

#### Modelos

- **ConfiguracionSSO** (Singleton)
  - `google_sso_activo`: Activa/desactiva el botón de Google SSO
  - `autocreacion_cliente_sso`: Crea automáticamente perfil de Cliente
  - `client_id`: Client ID de Google Cloud Console
  - `client_secret`: Client Secret (encriptado)
  - `activo`: Estado general del registro

#### Endpoints

**Públicos:**

- `GET /api/auth/configuracion/sso/public/` - Obtener configuración pública (sin credenciales)
- `GET /api/auth/login/google-oauth2/` - Iniciar flujo OAuth con Google

**Privados (requieren autenticación de propietario):**

- `GET /api/auth/configuracion/sso/` - Obtener configuración completa
- `PATCH /api/auth/configuracion/sso/` - Actualizar configuración

**OAuth Callbacks:**

- `/api/auth/complete/google-oauth2/` - Callback de Google OAuth

#### Pipeline Personalizado

```python
SOCIAL_AUTH_PIPELINE = (
    'social_core.pipeline.social_auth.social_details',
    'social_core.pipeline.social_auth.social_uid',
    'social_core.pipeline.social_auth.auth_allowed',
    'social_core.pipeline.social_auth.social_user',
    'social_core.pipeline.user.get_username',
    'social_core.pipeline.user.create_user',
    'apps.authentication.pipeline.create_cliente_profile',  # ← Custom
    'social_core.pipeline.social_auth.associate_user',
    'social_core.pipeline.social_auth.load_extra_data',
    'social_core.pipeline.user.user_details',
)
```

### Frontend (Next.js + React)

#### Componentes

- **GoogleSSOButton** (`src/components/auth/GoogleSSOButton.tsx`)
  - Fetch configuración desde API pública
  - Renderizado condicional
  - Ícono de Google integrado
  - Estados de loading y autenticación

#### Páginas

- **Login** (`src/app/login/page.tsx`) - Botón SSO después del formulario
- **Register** (`src/app/register/page.tsx`) - Botón SSO antes del formulario
- **Configuración SSO** (`src/app/dashboard/propietario/configuracion-sso/page.tsx`) - Panel del propietario

## 📦 Instalación

### 1. Backend

```bash
# Instalar dependencias
pip install social-auth-app-django==5.4.2

# Ejecutar migraciones
python manage.py migrate

# Inicializar configuración SSO
python Scripts/inicializar_sso.py
```

### 2. Variables de Entorno

Crear archivo `.env` en backend con:

```env
# Google OAuth
GOOGLE_OAUTH2_CLIENT_ID=tu_client_id_aqui
GOOGLE_OAUTH2_CLIENT_SECRET=tu_client_secret_aqui
GOOGLE_OAUTH2_REDIRECT_URI=http://localhost:8000/api/auth/complete/google-oauth2/

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### 3. Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita **Google+ API** (APIs & Services → Library)
4. Ve a **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Tipo de aplicación: **Web application**
6. Configura las URIs autorizadas:

   **Authorized JavaScript origins:**

   ```
   http://localhost:8000
   http://localhost:3000
   ```

   **Authorized redirect URIs:**

   ```
   http://localhost:8000/api/auth/complete/google-oauth2/
   ```

7. Copia **Client ID** y **Client Secret**

### 4. Configurar Credenciales

Tienes 3 opciones:

#### Opción A: Variables de Entorno (Recomendado)

```env
GOOGLE_OAUTH2_CLIENT_ID=1234567890-abcdef.apps.googleusercontent.com
GOOGLE_OAUTH2_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
```

#### Opción B: Django Admin

1. Accede a `/admin/`
2. Ve a **Authentication → Configuración SSO**
3. Ingresa Client ID y Client Secret
4. Guarda

#### Opción C: Dashboard Propietario

1. Accede a `/dashboard/propietario/configuracion-sso`
2. Ingresa Client ID y Client Secret
3. Haz clic en "Guardar cambios"

## 🎯 Uso

### Para Usuarios (Clientes)

1. **Login/Registro:**

   - Ve a `/login` o `/register`
   - Verás el botón "Continuar con Google" (si SSO está activo)
   - Haz clic en el botón
   - Autoriza en Google
   - Serás redirigido automáticamente al dashboard

2. **Primera vez con Google:**
   - Se crea automáticamente un usuario
   - Se asigna rol "Cliente" (si autocreación está activa)
   - Se crea perfil de Cliente vinculado

### Para Propietario

1. **Activar/Desactivar SSO:**

   - Accede a `/dashboard/propietario/configuracion-sso`
   - Activa/desactiva el switch "Activar Google SSO"
   - Guarda cambios

2. **Configurar Autocreación:**

   - En la misma página
   - Activa/desactiva "Crear perfil de Cliente automáticamente"
   - Si está desactivado, los usuarios OAuth solo tendrán rol Cliente sin perfil completo

3. **Actualizar Credenciales:**
   - Ingresa nuevos Client ID y Client Secret
   - Guarda cambios

## 🔒 Seguridad

- ✅ Client Secret nunca se expone en endpoint público
- ✅ Solo propietario puede modificar configuración
- ✅ Configuración es Singleton (no se puede duplicar)
- ✅ No se puede eliminar desde admin
- ✅ Auditoría de cambios en configuración
- ✅ Tokens de Google validados por social-auth-app-django

## 📊 Flujo de Autenticación

```
┌─────────────┐
│   Usuario   │
└──────┬──────┘
       │ 1. Click "Continuar con Google"
       ▼
┌─────────────────────────────────────┐
│  Frontend: GoogleSSOButton.tsx      │
│  window.location.href =             │
│  /api/auth/login/google-oauth2/     │
└──────┬──────────────────────────────┘
       │ 2. Redirect a Google
       ▼
┌─────────────────────────────────────┐
│  Google OAuth 2.0                   │
│  Usuario autoriza aplicación        │
└──────┬──────────────────────────────┘
       │ 3. Callback con código
       ▼
┌─────────────────────────────────────┐
│  Backend: social_django             │
│  /api/auth/complete/google-oauth2/  │
└──────┬──────────────────────────────┘
       │ 4. Pipeline personalizado
       ▼
┌─────────────────────────────────────┐
│  Pipeline: create_cliente_profile   │
│  - Asigna rol Cliente               │
│  - Crea perfil si no existe         │
└──────┬──────────────────────────────┘
       │ 5. Redirect a frontend
       ▼
┌─────────────────────────────────────┐
│  Frontend: /dashboard-cliente       │
│  Usuario autenticado                │
└─────────────────────────────────────┘
```

## 🧪 Testing

### Verificar Configuración

```bash
python Scripts/inicializar_sso.py
```

### Probar Endpoints

```bash
# Público (sin auth)
curl http://localhost:8000/api/auth/configuracion/sso/public/

# Privado (con token de propietario)
curl -H "Authorization: Token YOUR_TOKEN" \
     http://localhost:8000/api/auth/configuracion/sso/
```

### Verificar Botón en Frontend

1. Abre http://localhost:3000/login
2. Deberías ver el botón "Continuar con Google"
3. Si no aparece, verifica:
   - `google_sso_activo = True` en configuración
   - Frontend está haciendo fetch correctamente (ver consola del navegador)

## 📝 Archivos Modificados/Creados

### Backend

```
backend/
├── apps/authentication/
│   ├── models.py                 # + ConfiguracionSSO
│   ├── serializers.py            # + ConfiguracionSSOSerializer
│   ├── views.py                  # + configuracion_sso_view
│   ├── urls.py                   # + /configuracion/sso/ routes
│   ├── admin.py                  # + ConfiguracionSSOAdmin
│   └── pipeline.py               # ← NUEVO (create_cliente_profile)
├── core/
│   ├── settings.py               # + social_django, AUTHENTICATION_BACKENDS
│   └── urls.py                   # + social_django.urls
├── Scripts/
│   └── inicializar_sso.py        # ← NUEVO
├── requirements.txt              # + social-auth-app-django
└── .env.example                  # + GOOGLE_OAUTH2_*
```

### Frontend

```
frontend/src/
├── components/auth/
│   └── GoogleSSOButton.tsx       # ← NUEVO
├── app/
│   ├── login/page.tsx            # + GoogleSSOButton
│   ├── register/page.tsx         # + GoogleSSOButton
│   └── dashboard/propietario/
│       └── configuracion-sso/
│           └── page.tsx          # ← NUEVO
```

## 🔧 Troubleshooting

### Botón no aparece

- Verifica que `google_sso_activo = True`
- Revisa la consola del navegador (Network tab)
- Verifica que el endpoint `/api/auth/configuracion/sso/public/` responda

### Error al hacer clic en el botón

- Verifica las credenciales de Google Cloud Console
- Revisa las URIs autorizadas
- Verifica los logs del backend

### Error 403 al actualizar configuración

- Solo el propietario puede modificar la configuración
- Verifica que el usuario tenga rol `propietario`

### Usuario no se crea como Cliente

- Verifica que `autocreacion_cliente_sso = True`
- Revisa el pipeline en `settings.py`
- Verifica logs del backend para errores en pipeline

## 📚 Referencias

- [Django Social Auth Documentation](https://python-social-auth.readthedocs.io/)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [social-auth-app-django GitHub](https://github.com/python-social-auth/social-app-django)

## ✅ Checklist de Implementación

- [x] Modelo ConfiguracionSSO creado
- [x] Migraciones aplicadas
- [x] social-auth-app-django instalado
- [x] Settings configurado (INSTALLED_APPS, AUTHENTICATION_BACKENDS)
- [x] Pipeline personalizado creado
- [x] Serializers y vistas implementadas
- [x] URLs configuradas (backend)
- [x] GoogleSSOButton.tsx creado
- [x] Login/Register integrados
- [x] Panel de configuración para propietario
- [x] Admin de Django configurado
- [x] Script de inicialización creado
- [x] .env.example actualizado
- [x] Documentación completa

## 🎉 ¡Sistema Completo!

El sistema de Google SSO está completamente implementado y listo para usar. Solo falta configurar las credenciales de Google Cloud Console para activarlo en producción.
