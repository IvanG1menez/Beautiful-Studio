# 🔐 Solución para Problemas de Login

## 🚨 Problema

Después de modificar horarios de profesionales, no puedes iniciar sesión en ninguna cuenta. El servidor devuelve:

```
Unauthorized: /api/users/login/
[17/Nov/2025 03:10:34] "POST /api/users/login/ HTTP/1.1" 401 66
```

---

## 🔍 Posibles Causas

1. **Base de datos corrompida**: Los hashes de contraseñas se dañaron
2. **Migración incorrecta**: Cambios en el modelo User no aplicados correctamente
3. **Token inválido**: Tokens de autenticación corruptos
4. **Usuario desactivado**: La cuenta fue deshabilitada accidentalmente

---

## ✅ Soluciones

### Opción 1: Script Automático (Recomendado)

Desde la carpeta `backend/`, ejecutar:

```cmd
fix_login.bat
```

Este menú te permite:

1. Verificar usuarios y probar contraseñas
2. Resetear contraseña de cualquier usuario
3. Ver logs del servidor

---

### Opción 2: Verificar Usuarios Manualmente

```cmd
cd backend
python Scripts\check_users.py
```

Esto mostrará:

- Lista de todos los usuarios
- Estado activo/inactivo
- Validez del hash de contraseña
- Opción para probar una contraseña

**Ejemplo de salida:**

```
✅ ID 1: admin@example.com
   Nombre: Admin User
   Rol: propietario
   Activo: True
   Hash válido: ✅ (pbkdf2_sha256)

✅ ID 2: cliente@example.com
   Nombre: Juan Pérez
   Rol: cliente
   Activo: True
   Hash válido: ✅ (pbkdf2_sha256)
```

---

### Opción 3: Resetear Contraseña

```cmd
cd backend
python Scripts\reset_password.py
```

**Pasos:**

1. Se muestra lista de usuarios con IDs
2. Ingresar ID del usuario a resetear
3. Ingresar nueva contraseña (mínimo 6 caracteres)
4. Confirmar contraseña
5. ✅ Contraseña reseteada

**Ejemplo:**

```
📋 USUARIOS DISPONIBLES:
1. admin@example.com - Admin User (propietario)
2. cliente@example.com - Juan Pérez (cliente)
3. prof@example.com - Ana García (profesional)

Ingresa el ID del usuario: 2
✅ Usuario seleccionado:
   Email: cliente@example.com
   Nombre: Juan Pérez
   Rol: cliente

Ingresa la nueva contraseña: password123
Confirma la contraseña: password123

✅ CONTRASEÑA CAMBIADA EXITOSAMENTE
   Usuario: cliente@example.com
   Nueva contraseña: password123
```

---

### Opción 4: Usar Django Admin

1. Ir a: `http://127.0.0.1:8000/admin/`
2. Login con credenciales de superusuario
3. Ir a **Autenticación y Autorización** → **Usuarios**
4. Seleccionar el usuario con problemas
5. Scroll hasta **Contraseña**
6. Click en el link "cambiar contraseña"
7. Ingresar nueva contraseña y confirmar

---

### Opción 5: Resetear desde Django Shell

```cmd
cd backend
python manage.py shell
```

Luego ejecutar:

```python
from apps.users.models import User

# Buscar el usuario
user = User.objects.get(email='cliente@example.com')

# Cambiar contraseña
user.set_password('nueva_password')
user.save()

print(f"✅ Contraseña cambiada para {user.email}")
```

---

## 🧪 Verificar que Funciona

### 1. Probar Login desde Terminal

```cmd
curl -X POST http://127.0.0.1:8000/api/users/login/ ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"cliente@example.com\",\"password\":\"password123\"}"
```

**Respuesta esperada (exitosa):**

```json
{
  "token": "abc123def456...",
  "user": {
    "id": 2,
    "email": "cliente@example.com",
    "username": "cliente",
    "role": "cliente",
    ...
  }
}
```

**Respuesta de error:**

```json
{
  "error": "Contraseña incorrecta",
  "error_code": "INVALID_PASSWORD"
}
```

---

### 2. Probar desde el Frontend

1. Abrir: `http://localhost:3000/login`
2. Ingresar email y contraseña
3. Click en **Iniciar Sesión**
4. ✅ Debe redirigir al dashboard correspondiente

---

## 🔧 Diagnóstico Avanzado

### Verificar Hash de Contraseña

En Django Shell:

```python
from apps.users.models import User
from django.contrib.auth.hashers import check_password

user = User.objects.get(email='cliente@example.com')

# Ver el hash
print(f"Hash: {user.password}")
# Debe empezar con: pbkdf2_sha256$...

# Probar contraseña
if check_password('password123', user.password):
    print("✅ Contraseña correcta")
else:
    print("❌ Contraseña incorrecta")
```

---

### Verificar Tokens

```python
from rest_framework.authtoken.models import Token

# Ver todos los tokens
tokens = Token.objects.all()
for token in tokens:
    print(f"{token.user.email}: {token.key}")

# Eliminar tokens corruptos
Token.objects.all().delete()
print("✅ Todos los tokens eliminados")
```

---

### Activar Usuario Deshabilitado

```python
from apps.users.models import User

user = User.objects.get(email='cliente@example.com')
user.is_active = True
user.save()
print(f"✅ Usuario {user.email} activado")
```

---

## 📊 Códigos de Error Comunes

| Código                 | Error                    | Solución                        |
| ---------------------- | ------------------------ | ------------------------------- |
| `INVALID_PASSWORD`     | Contraseña incorrecta    | Resetear contraseña             |
| `USER_NOT_FOUND`       | Email no existe          | Verificar email o crear usuario |
| `ACCOUNT_DISABLED`     | Cuenta desactivada       | Activar con `is_active = True`  |
| `MISSING_CREDENTIALS`  | Falta email o contraseña | Completar ambos campos          |
| `TOKEN_CREATION_ERROR` | Error al crear token     | Ejecutar migraciones            |

---

## 🚀 Prevención

### Backup Antes de Modificar

Antes de modificar horarios u otros datos críticos:

```cmd
cd backend
python manage.py dumpdata > backup.json
```

Para restaurar:

```cmd
python manage.py loaddata backup.json
```

---

### Crear Usuario de Prueba

```python
from apps.users.models import User

# Crear superusuario de emergencia
User.objects.create_superuser(
    username='emergency',
    email='emergency@test.com',
    password='emergency123',
    first_name='Emergency',
    last_name='Admin'
)
```

---

## 📝 Notas Importantes

1. **No modifiques manualmente la tabla de usuarios** en la base de datos SQLite
2. **Siempre usa `set_password()`** en lugar de asignar directamente a `user.password`
3. **Los tokens no expiran** por defecto en Django, pero puedes eliminarlos manualmente
4. **Si nada funciona**, considera crear un nuevo superusuario y migrar los datos

---

## ❓ FAQ

**P: ¿Por qué se corrompieron las contraseñas al modificar horarios?**
R: Es poco probable que la modificación de horarios afecte las contraseñas directamente. Puede ser:

- Un problema de migración concurrente
- Error en algún script de generación de datos
- Modificación accidental en Django Admin

**P: ¿Puedo recuperar la contraseña original?**
R: No. Django usa hashing unidireccional. Debes resetear la contraseña.

**P: ¿Afecta esto a otros datos?**
R: No. Solo afecta la autenticación. Los turnos, clientes y servicios están intactos.

---

## 🆘 Última Opción: Recrear Usuario

Si TODO falla:

```python
from apps.users.models import User

# Eliminar usuario problemático
User.objects.filter(email='cliente@example.com').delete()

# Crear nuevo usuario
User.objects.create_user(
    username='cliente_nuevo',
    email='cliente@example.com',
    password='password123',
    first_name='Juan',
    last_name='Pérez',
    role='cliente'
)
```

---

**Última actualización:** Noviembre 17, 2025
