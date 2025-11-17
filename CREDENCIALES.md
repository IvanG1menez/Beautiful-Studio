# 🔑 Credenciales de Acceso - Beautiful Studio

## ✅ Contraseñas Reseteadas

Todas las contraseñas han sido reseteadas a valores por defecto según el rol del usuario.

---

## 👤 Credenciales por Rol

### 🏢 Propietario

- **Contraseña:** `admin123`
- **Ejemplo:**
  ```
  Email: admin@test.com
  Contraseña: admin123
  ```

### 💇 Profesionales

- **Contraseña:** `profesional123`
- **Ejemplos:**

  ```
  Email: mailfalso321@yahoo.com
  Contraseña: profesional123

  Email: jose.puerta@example.com
  Contraseña: profesional123
  ```

### 👥 Clientes

- **Contraseña:** `cliente123`
- **Ejemplos:**
  ```
  Email: cualquier_cliente@example.com
  Contraseña: cliente123
  ```

---

## 🚀 Cómo Iniciar Sesión

### Opción 1: Frontend (Aplicación Web)

1. Ir a: http://localhost:3000/login
2. Ingresar email del usuario
3. Ingresar contraseña según el rol:
   - Propietario: `admin123`
   - Profesional: `profesional123`
   - Cliente: `cliente123`
4. Click en **Iniciar Sesión**

### Opción 2: Django Admin (Solo Propietarios)

1. Ir a: http://127.0.0.1:8000/admin/
2. Email: `admin@test.com`
3. Contraseña: `admin123`

---

## 📋 Listado de Usuarios

### Para ver todos los usuarios disponibles:

```cmd
cd backend
venv\Scripts\python.exe Scripts\check_users.py
```

Esto mostrará:

- Todos los emails registrados
- Roles de cada usuario
- Estado activo/inactivo

---

## 🔧 Cambiar Contraseña Individual

Si quieres cambiar la contraseña de un usuario específico:

```cmd
cd backend
venv\Scripts\python.exe Scripts\reset_password.py
```

Luego sigue las instrucciones en pantalla.

---

## ⚠️ Importante

- Estas son **contraseñas de desarrollo/prueba**
- En producción, usa contraseñas seguras
- Cada usuario puede cambiar su contraseña desde su perfil

---

## 🧪 Probar Login

Para verificar que el login funciona:

```cmd
cd backend
venv\Scripts\python.exe Scripts\test_login.py
```

---

## 📝 Resumen Rápido

| Rol         | Contraseña       | Ejemplo de Usuario           |
| ----------- | ---------------- | ---------------------------- |
| Propietario | `admin123`       | admin@test.com               |
| Profesional | `profesional123` | mailfalso321@yahoo.com       |
| Cliente     | `cliente123`     | cualquier cliente registrado |

---

**Última actualización:** 17 de Noviembre, 2025
